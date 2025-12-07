import { Client, GatewayIntentBits } from 'discord.js'
import dotenv from 'dotenv'
import { EventEmitter } from 'events'
import { Connectors, Shoukaku } from 'shoukaku'

dotenv.config()

export const audioEvents = new EventEmitter()

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
})

const Nodes = [
  {
    name: 'Localhost',
    url: 'localhost:2333',
    auth: 'youshallnotpass',
  },
]

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes)

shoukaku.on('error', (_, error) => console.error('[SHOUKAKU ERROR]', error))
shoukaku.on('ready', name => console.log(`[SHOUKAKU] Node ${name} is ready`))
shoukaku.on('close', (name, code, reason) => console.warn(`[SHOUKAKU] Node ${name} closed with code ${code} reason ${reason}`))
shoukaku.on('disconnect', (name, count) => {
  console.warn(`[SHOUKAKU] Node ${name} disconnected. Players disconnected: ${count}`)
})

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`)
})

// Listen for voice state updates to detect when all users leave the channel
client.on('voiceStateUpdate', (oldState, newState) => {
  // Only check if someone left a channel (not joined or switched)
  if (!oldState.channelId) return

  const guild = oldState.guild
  const botMember = guild.members.me

  // Check if bot is in a voice channel
  if (!botMember?.voice.channelId) return

  // Check if the user left the same channel as the bot
  if (oldState.channelId !== botMember.voice.channelId) return

  // Get the channel the bot is in
  const botChannel = guild.channels.cache.get(botMember.voice.channelId)
  if (!botChannel || !botChannel.isVoiceBased()) return

  // Count non-bot members in the channel
  const humanMembers = botChannel.members.filter(member => !member.user.bot)

  if (humanMembers.size === 0) {
    console.log('[BOT] All users left the voice channel. Disconnecting bot...')

    // Disconnect the bot
    shoukaku.leaveVoiceChannel(guild.id)

    // Emit event to notify server to stop playback
    audioEvents.emit('allUsersLeft', guild.id)
  }
})

export async function initBot() {
  if (!process.env.DISCORD_TOKEN) {
    console.warn('DISCORD_TOKEN not found in .env, bot will not start.')
    return
  }
  await client.login(process.env.DISCORD_TOKEN)
  return client
}

interface PlayerState {
  lastKnownPosition: number
  lastUpdateTime: number
  isPlaying: boolean
}

const playerStates = new Map<string, PlayerState>()

function getGuildState(guildId: string): PlayerState {
  if (!playerStates.has(guildId)) {
    playerStates.set(guildId, {
      lastKnownPosition: 0,
      lastUpdateTime: Date.now(),
      isPlaying: false,
    })
  }
  return playerStates.get(guildId)!
}

export async function playSong(url: string, guildId: string) {
  try {
    const guild = client.guilds.cache.get(guildId)

    if (!guild) {
      console.error(`[BOT ERROR] Guild ${guildId} not found`)
      return
    }

    const node = shoukaku.options.nodeResolver(shoukaku.nodes)
    if (!node) {
      console.error('[SHOUKAKU ERROR] No available Lavalink node')
      return
    }

    // Check if bot is actually in a voice channel
    const botVoiceState = guild.members.me?.voice
    const isInVoiceChannel = botVoiceState?.channelId != null

    let existingPlayer = shoukaku.players.get(guild.id)

    // If player exists but bot is not in a voice channel, destroy the stale player
    if (existingPlayer && !isInVoiceChannel) {
      console.log(`[BOT] Player exists but bot is not in voice channel in guild ${guildId}. Destroying stale player...`)
      shoukaku.leaveVoiceChannel(guild.id)
      existingPlayer = undefined
    }

    let player = existingPlayer
    let voiceChannelId = botVoiceState?.channelId

    // If no player or bot is not in a channel, join a voice channel
    if (!player || !voiceChannelId) {
      console.log(`[BOT] Bot is not in a voice channel in guild ${guildId}. Finding a channel to join...`)

      // Find a voice channel with members
      const voiceChannel = guild.channels.cache.find(c => {
        return c.isVoiceBased() && c.joinable && c.members.size > 0
      })

      if (!voiceChannel) {
        console.error(`[BOT ERROR] No joinable voice channel with members found in guild ${guildId}`)
        return
      }

      voiceChannelId = voiceChannel.id
      console.log('[BOT] Joining voice channel:', voiceChannel.name)

      // Join channel using shoukaku.joinVoiceChannel
      player = await shoukaku.joinVoiceChannel({
        guildId: guild.id,
        channelId: voiceChannelId,
        shardId: 0,
      })

      // Set up event listeners for new player
      player.on('start', () => {
        console.log(`[SHOUKAKU] Track started in guild ${guildId}`)
        updatePlayerState(guildId, true, 0)
      })

      player.on('end', reason => {
        console.log(`[SHOUKAKU] Track ended in guild ${guildId}. Reason:`, reason)
        updatePlayerState(guildId, false, 0)
        audioEvents.emit('trackEnd', { guildId, reason })
      })

      player.on('exception', (err: any) => {
        console.error(`[SHOUKAKU ERROR] Track exception in guild ${guildId}:`, err)
      })

      player.on('stuck', (data: any) => {
        console.warn(`[SHOUKAKU] Track stuck in guild ${guildId}:`, data)
        audioEvents.emit('trackStuck', { guildId, data })
      })

      player.on('update', (data: any) => {
        // console.log(`[SHOUKAKU] Player update in guild ${guildId}:`, data)
        if (player) {
          updatePlayerState(guildId, !player.paused, data.state.position)
        }
      })

      console.log('[BOT] Successfully joined voice channel and created player')
    } else {
      console.log('[BOT] Using existing player in channel:', botVoiceState?.channel?.name)
    }

    // Sanitize URL to remove playlist parameters if it's a YouTube video
    let cleanUrl = url
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      try {
        const urlObj = new URL(url)
        if (urlObj.searchParams.has('v')) {
          cleanUrl = `https://www.youtube.com/watch?v=${urlObj.searchParams.get('v')}`
        }
      } catch (e) {
        // Invalid URL, ignore
      }
    }

    // Resolve track
    const result = await node.rest.resolve(cleanUrl)
    if (!result || result.loadType === 'empty') {
      console.error('[SHOUKAKU ERROR] No tracks found for URL:', url)
      return
    }

    console.log('[SHOUKAKU] Resolve result loadType:', result.loadType)

    if (result.loadType === 'error') {
      console.error('[SHOUKAKU ERROR] Lavalink failed to resolve track:', result.data)
      return
    }

    let track = result.data
    if (result.loadType === 'playlist') {
      track = (result.data as any).tracks[0]
    } else if (Array.isArray(result.data)) {
      track = result.data[0]
    }

    if (!track) {
      console.error('[SHOUKAKU ERROR] Could not extract track data')
      return
    }

    // console.log('[SHOUKAKU] Track object:', track)
    console.log('[SHOUKAKU] Playing track:', (track as any).info?.title || 'Unknown Title')
    console.log('[SHOUKAKU] Track encoded:', (track as any).encoded)

    // Play track
    await player.playTrack({ track: { encoded: (track as any).encoded } })

    return track
  } catch (error) {
    console.error('[BOT ERROR] Error playing song:', error)
    return null
  }
}

export async function resolveTrack(url: string) {
  const node = shoukaku.options.nodeResolver(shoukaku.nodes)
  if (!node) return null

  // Sanitize URL to remove playlist parameters if it's a YouTube video
  let cleanUrl = url
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    try {
      const urlObj = new URL(url)
      if (urlObj.searchParams.has('v')) {
        cleanUrl = `https://www.youtube.com/watch?v=${urlObj.searchParams.get('v')}`
      }
    } catch (e) {
      // Invalid URL, ignore
    }
  }

  try {
    const result = await node.rest.resolve(cleanUrl)
    if (!result || result.loadType === 'empty' || result.loadType === 'error') {
      return null
    }

    let track = result.data
    if (result.loadType === 'playlist') {
      track = (result.data as any).tracks[0]
    } else if (Array.isArray(result.data)) {
      track = result.data[0]
    }

    return track
  } catch (error) {
    console.error('[BOT ERROR] Error resolving track:', error)
    return null
  }
}

export async function resolvePlaylist(url: string) {
  const node = shoukaku.options.nodeResolver(shoukaku.nodes)
  if (!node) return null

  try {
    console.log('[BOT] Resolving playlist:', url)
    const result = await node.rest.resolve(url)

    if (!result || result.loadType === 'empty' || result.loadType === 'error') {
      console.error('[BOT] Failed to resolve playlist:', result?.loadType)
      return null
    }

    if (result.loadType === 'playlist') {
      const playlistData = result.data as any
      console.log('[BOT] Playlist resolved:', playlistData.info?.name, '- Tracks:', playlistData.tracks?.length)
      return {
        name: playlistData.info?.name || 'Unknown Playlist',
        tracks: playlistData.tracks || [],
      }
    } else {
      console.warn('[BOT] URL is not a playlist, loadType:', result.loadType)
      return null
    }
  } catch (error) {
    console.error('[BOT ERROR] Error resolving playlist:', error)
    return null
  }
}

export async function pauseSong(guildId: string) {
  const player = shoukaku.players.get(guildId)
  if (player) {
    const currentPos = getPlayerPosition(guildId)
    // Only pause, do not seek as it might trigger resume in NodeLink
    await player.setPaused(true)
    updatePlayerState(guildId, false, currentPos)
    console.log(`[SHOUKAKU] Player paused in guild ${guildId}`)
  }
}

export async function resumeSong(guildId: string) {
  const player = shoukaku.players.get(guildId)
  if (player) {
    player.setPaused(false)
    updatePlayerState(guildId, true)
    console.log(`[SHOUKAKU] Player resumed in guild ${guildId}`)
  }
}

export function stopSong(guildId: string) {
  const player = shoukaku.players.get(guildId)
  if (player) {
    player.stopTrack()
    console.log(`[SHOUKAKU] Player stopped in guild ${guildId}`)
  }
}

export async function seekSong(guildId: string, position: number) {
  const player = shoukaku.players.get(guildId)
  if (player) {
    const state = getGuildState(guildId)
    const shouldBePaused = !state.isPlaying

    // Atomically update position and paused state
    await player.update({ position, paused: shouldBePaused })

    // Double check: Force pause if it should be paused, to be absolutely sure
    if (shouldBePaused) {
      await player.setPaused(true)
      // Triple check: Some Lavalink nodes (like NodeLink) might auto-resume after seek
      // We force pause again after a short delay to override any auto-resume
      setTimeout(async () => {
        if (player) {
          await player.setPaused(true)
          updatePlayerState(guildId, false, position)
        }
      }, 100)
    }

    // Update our manual position tracking
    updatePlayerState(guildId, !shouldBePaused, position)
    console.log(`[SHOUKAKU] Player seeked to: ${position} in guild ${guildId}. Should be paused: ${shouldBePaused}`)
    return shouldBePaused
  }
  return false
}

export function getPlayerPosition(guildId: string) {
  const player = shoukaku.players.get(guildId)
  const state = getGuildState(guildId)
  if (player) {
    if (state.isPlaying) {
      // Calculate position based on time elapsed
      const elapsed = Date.now() - state.lastUpdateTime
      return state.lastKnownPosition + elapsed
    }
    return state.lastKnownPosition
  }
  return 0
}

export function updatePlayerState(guildId: string, playing: boolean, position?: number) {
  const state = getGuildState(guildId)
  state.isPlaying = playing
  if (position !== undefined) {
    state.lastKnownPosition = position
  }
  state.lastUpdateTime = Date.now()
}

export const bot = client
