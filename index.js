import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Define bot commands
const commands = [
  { command: 'start', description: 'Start the bot and enter a query' },
  { command: 'about', description: 'Get information about the bot and the developer' }
];

// Set bot commands
bot.telegram.setMyCommands(commands)
  .then(() => console.log('Bot commands set'))
  .catch(err => console.error('Failed to set bot commands:', err));

// Initialize state
const userState = {}; // Track search queries and pagination

// Start command
bot.start(async (ctx) => {
  await ctx.reply('Welcome to TeTube! Please enter a query to search for YouTube videos.\n\nType /about for more information.');
});

// About command
bot.command('about', (ctx) => {
  const aboutText = `
*Bot Description:*
*TeTube* is a Telegram bot that helps users find top YouTube videos based on their search queries. Simply type a query, and TeTube will provide the top 3 most viewed videos related to your query. It's designed for quick and easy access to trending video content directly within Telegram.

*About the Developer:*
*Mehedi Al Tayib* is a skilled developer with expertise in creating engaging and functional bots. With a passion for enhancing user experiences through technology, Tayib designs innovative solutions like TeTube to make information more accessible and interactive.
`;

  const facebookUrl = 'https://www.facebook.com/mehedialtayib10';
  const websiteUrl = 'https://www.mehedialtayib.com';

  ctx.replyWithMarkdown(aboutText, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Facebook', url: facebookUrl },
          { text: 'Website', url: websiteUrl }
        ]
      ]
    }
  });
});

// Handle text (YouTube search query)
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const query = ctx.message.text;

  userState[userId] = { query, pageToken: '' }; // Initialize user state
  await fetchAndSendVideos(ctx);
});

// Fetch and send videos
async function fetchAndSendVideos(ctx) {
  const userId = ctx.from.id;
  const { query, pageToken } = userState[userId];

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=3&pageToken=${pageToken}&key=${process.env.YT_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('Search Response:', data);  // Debug: Log the search response

    const videos = data.items;
    if (!videos || videos.length === 0) {
      ctx.reply('No videos found.');
      return;
    }

    // Get video IDs for fetching statistics
    const videoIds = videos.map(video => video.id.videoId).join(',');
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${process.env.YT_API_KEY}`;
    const statsResponse = await fetch(statsUrl);
    const statsData = await statsResponse.json();
    console.log('Statistics Response:', statsData);  // Debug: Log the statistics response

    const videoStats = statsData.items;

    // Sort videos based on view count
    const sortedVideos = videos
      .map((video, index) => ({
        ...video,
        viewCount: videoStats[index]?.statistics?.viewCount || 0
      }))
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 3);

    if (sortedVideos.length === 0) {
      ctx.reply('No videos found.');
      return;
    }

    const currentYear = new Date().getFullYear();
    const footer = `© ${currentYear} | Developed by MEHEDI AL TAYIB`;

    // Send the top 3 videos with footer
    let message = '';
    sortedVideos.forEach((video, index) => {
      const videoUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
      message += `${index + 1}. ${video.snippet.title} (${video.viewCount} views)\n${videoUrl}\n\n`;
    });
    message += footer;

    const keyboard = data.nextPageToken ? [
      [{ text: 'More Videos', callback_data: 'more_videos' }]
    ] : [];

    ctx.reply(message, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    // Update user state
    userState[userId].pageToken = data.nextPageToken || '';
  } catch (error) {
    console.error('Error:', error);  // Debug: Log the error
    ctx.reply('Error fetching videos. Please try again later.');
  }
}

// Handle Callback Queries
bot.on('callback_query', async (ctx) => {
  if (ctx.callbackQuery.data === 'more_videos') {
    await fetchAndSendVideos(ctx);
  }
});

// Start Bot
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
