import { Client, GatewayIntentBits } from 'discord.js'
import { Shoukaku, Connectors } from 'shoukaku'
import dotenv from 'dotenv'
import { EventEmitter } from 'events'

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
    audioEvents.emit('allUsersLeft')
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

// Helper to get a player for a guild
async function getPlayer(guildId: string) {
  const node = shoukaku.options.nodeResolver(shoukaku.nodes)
  if (!node) return null

  const existingPlayer = shoukaku.players.get(guildId)
  if (existingPlayer) return existingPlayer

  // If no player, we need to join a channel first.
  // This helper assumes we want to find an existing player.
  return null
}

export async function playSong(url: string, guildId?: string) {
  try {
    const targetGuildId = '645090017609252875'
    const guild = client.guilds.cache.get(targetGuildId)

    if (!guild) {
      console.error(`[BOT ERROR] Guild ${targetGuildId} not found`)
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
      console.log('[BOT] Player exists but bot is not in voice channel. Destroying stale player...')
      shoukaku.leaveVoiceChannel(guild.id)
      existingPlayer = undefined
    }

    let player = existingPlayer
    let voiceChannelId = botVoiceState?.channelId

    // If no player or bot is not in a channel, join a voice channel
    if (!player || !voiceChannelId) {
      console.log('[BOT] Bot is not in a voice channel. Finding a channel to join...')

      // Find a voice channel with members
      const voiceChannel = guild.channels.cache.find(c => {
        return c.isVoiceBased() && c.joinable && c.members.size > 0
      })

      if (!voiceChannel) {
        console.error('[BOT ERROR] No joinable voice channel with members found')
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
        console.log('[SHOUKAKU] Track started')
        updatePlayerState(true, 0)
      })

      player.on('end', reason => {
        console.log('[SHOUKAKU] Track ended. Reason:', reason)
        updatePlayerState(false, 0)
        audioEvents.emit('trackEnd', reason)
      })

      player.on('exception', (err: any) => {
        console.error('[SHOUKAKU ERROR] Track exception:', err)
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

export async function pauseSong() {
  const targetGuildId = '645090017609252875'
  const player = shoukaku.players.get(targetGuildId)
  if (player) {
    const currentPos = getPlayerPosition()
    player.setPaused(true)
    // Seek to current position to flush the buffer and stop audio instantly
    await player.update({ position: currentPos })
    console.log('[SHOUKAKU] Player paused and seeked to flush buffer')
  }
}

export async function resumeSong() {
  const targetGuildId = '645090017609252875'
  const player = shoukaku.players.get(targetGuildId)
  if (player) {
    player.setPaused(false)
    console.log('[SHOUKAKU] Player resumed')
  }
}

export function stopSong() {
  const targetGuildId = '645090017609252875'
  const player = shoukaku.players.get(targetGuildId)
  if (player) {
    player.stopTrack()
    console.log('[SHOUKAKU] Player stopped')
  }
}

export async function seekSong(position: number) {
  const targetGuildId = '645090017609252875'
  const player = shoukaku.players.get(targetGuildId)
  if (player) {
    await player.update({ position })
    // Update our manual position tracking
    updatePlayerState(isPlaying, position)
    console.log('[SHOUKAKU] Player seeked to:', position)
  }
}

let lastKnownPosition = 0
let lastUpdateTime = Date.now()
let isPlaying = false

export function getPlayerPosition() {
  const targetGuildId = '645090017609252875'
  const player = shoukaku.players.get(targetGuildId)
  if (player) {
    if (isPlaying) {
      // Calculate position based on time elapsed
      const elapsed = Date.now() - lastUpdateTime
      return lastKnownPosition + elapsed
    }
    return lastKnownPosition
  }
  return 0
}

export function updatePlayerState(playing: boolean, position?: number) {
  isPlaying = playing
  if (position !== undefined) {
    lastKnownPosition = position
  }
  lastUpdateTime = Date.now()
}

export const bot = client
