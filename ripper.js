#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import yargs from 'yargs';
import omelette from 'omelette';
import { hideBin } from 'yargs/helpers';
// import ytdl from 'ytdl-core';
import ytdl from "@distube/ytdl-core"; // Patch for ytdl-core form the lovely folks at https://github.com/distubejs/ytdl-core
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import unidecode from 'unidecode';
import emojiStrip from 'emoji-strip';
import cp from 'child_process';
import ffmpegStatic from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegPath);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get version
const packageJsonPath = path.resolve(__dirname, './package.json');
const packageJsonData = fs.readFileSync(packageJsonPath);
const packageJsonObj = JSON.parse(packageJsonData);
const version = packageJsonObj.version;

const chalkLog = console.log;

const completion = omelette('ripper <command> <command> <command>');

completion.on('command', ({ reply }) => {
  reply(['-f', '-u', '-d', '-o']);
});
completion.init();

yargs(hideBin(process.argv))
  .scriptName(chalk.green("ripper"))
  .usage(chalk.yellow('Usage: $0 <command> [options]'))
  .version('v', 'Show version', chalk.magenta('ripper') + chalk.greenBright(` v${version}`))
  .command('audio', 'download audio', {
    'f': {
      alias: 'format',
      describe: 'The file format',
      choices: ['wav', 'mp3'],
      demandOption: true,
    },
    'u': {
      alias: 'url',
      describe: 'Youtube URL',
      type: 'string',
      demandOption: true,
    },
    'o': {
      alias: 'output',
      describe: 'Output path',
      type: 'string',
      default: path.join(__dirname, 'ripper-downloads'),
    }
  }, function(argv) {
    ripAudio(argv.url, argv.output, argv.format).catch(console.error);
  })
  .command('video', 'download video', {
    'f': {
      alias: 'format',
      describe: 'The file format',
      choices: ['mp4', 'mkv'],
      demandOption: true,
    },
    'u': {
      alias: 'url',
      describe: 'Youtube URL',
      type: 'string',
      demandOption: true,
    },
    'o': {
      alias: 'output',
      describe: 'Output path',
      type: 'string',
      default: path.join(__dirname, 'ripper-downloads'),
    }
  }, function(argv) {
    ripVideo(argv.url, argv.output, argv.format).catch(console.error);
  })
  .completion()
  .epilog(chalk.yellow('Check the readme at https://github.com/denizensofhell/ripper/blob/main/README.md'))
  .parse()


// ************************* RIP AUDIO ************************** //
async function ripAudio(ytUrl, outputDirectory, filetype) {
  if(!validateYTUrl(ytUrl)) return;

  // Get audio details
  chalkLog(chalk.white('Retrieving audio details...'));
  const info = await ytdl.getInfo(ytUrl);
  chalkLog(chalk.greenBright('Audio details retrieved.'));
  const title = sanitizeFileName(info.videoDetails.title);

  // Set output
  const output = path.join(outputDirectory, `${title}.${filetype}`);

  // Progress Bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.blue('{bar}') + '| ' + chalk.yellow('{percentage}%') + ' || {value}/{total} Chunks',
  }, cliProgress.Presets.shades_classic);
  // Set start of progress bar
  progressBar.start(1, 0);

  // Set audio stream
  const audioStream = ytdl(ytUrl, { quality: 'highestaudio' }).on('progress', (chunkLength, downloaded, total) => {
    const percent = downloaded / total;
    progressBar.update(percent);
  });

  // Download
  audioStream.pipe(fs.createWriteStream(output)).on('finish', () => {
    progressBar.stop();
    chalkLog(chalk.greenBright(`'${title}' downloaded`) + chalk.white(` | ${output}`));
  });
}

// ************************* RIP VIDEO ************************** //
async function ripVideo(ytUrl, outputDirectory, filetype) {
  if(!validateYTUrl(ytUrl)) return;

  // Get video details
  chalkLog(chalk.white('Retrieving video details...'));
  const info = await ytdl.getInfo(ytUrl);
  chalkLog(chalk.greenBright('Video details retrieved.'));
  const title = sanitizeFileName(info.videoDetails.title);

  // Set output
  const output = path.join(outputDirectory, `${title}.${filetype}`);

  // Progress Bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.blue('{bar}') + '| ' + chalk.yellow('{percentage}%') + ' || {value}/{total} Chunks',
  }, cliProgress.Presets.shades_classic);
  // Set start of progress bar
  progressBar.start(1, 0);

  // Set video stream
  const videoStream = ytdl(ytUrl, { quality: 'highestvideo' }).on('progress', (chunkLength, downloaded, total) => {
    const percent = (downloaded / total);
    progressBar.update(percent);
  });
  // Set audio stream
  const audioStream = ytdl(ytUrl, { quality: 'highestaudio' }).on('progress', (chunkLength, downloaded, total) => {
    const percent = (downloaded / total);
    progressBar.update(percent);
  });

  stitchWithFFMPEG(audioStream, videoStream, output, progressBar, title);
}


// HELPER FUNCTIONS
// ************************* STITCH WITH FFMPEG ************************** //
function stitchWithFFMPEG(audioStream, videoStream, output, progressBar, title) {
  // Spawn ffmpeg
  // https://github.com/fent/node-ytdl-core/blob/master/example/ffmpeg.js
  const ffmpegProcess = cp.spawn(ffmpegStatic, [
    // Remove ffmpeg's console spamming
    '-loglevel', '8', '-hide_banner',
    // Redirect/Enable progress messages
    '-progress', 'pipe:3',
    // Set inputs
    '-i', 'pipe:4',
    '-i', 'pipe:5',
    // Map audio & video from streams
    '-map', '0:a',
    '-map', '1:v',
    // Keep encoding
    '-c:v', 'copy',
    // Define output file
    output,
  ], {
    windowsHide: true,
    stdio: [
      /* Standard: stdin, stdout, stderr */
      'inherit', 'inherit', 'inherit',
      /* Custom: pipe:3, pipe:4, pipe:5 */
      'pipe', 'pipe', 'pipe',
    ],
  });

  // When the ffmpeg process writes to the progress pipe, update the progress bar
  ffmpegProcess.stdio[3].on('data', chunk => {
    const lines = chunk.toString().trim().split('\n');
    for (const l of lines) {
      const [key, value] = l.split('=');
      if (key.trim() === 'progress') {
        // Update progress bar based on FFmpeg progress (if available)
        const percent = parseFloat(value);
        if (!isNaN(percent)) {
          progressBar.update(percent);
        }
      }
    }
  });

  // When the ffmpeg process closes, stop the progress bar
  ffmpegProcess.on('close', () => {
    progressBar.stop();
    chalkLog(chalk.greenBright(`'${title}' downloaded`) + chalk.white(` | ${output}`));
  });

  // Call the ffmpeg process with the streams
  audioStream.pipe(ffmpegProcess.stdio[4]);
  videoStream.pipe(ffmpegProcess.stdio[5]);
}

// ************************* VALIDATE YT URL ************************** //
function validateYTUrl(ytUrl) {
  if(!ytdl.validateURL(ytUrl)) {
    chalkLog(chalk.black.bgRed('Invalid Url'));
    return false;
  }
  return true;
}

// ************************* CONVERT TO ASCII ************************** //
function sanitizeFileName(title) {
  let stripedOfEmojies = emojiStrip(title);
  let asciiConvert = stripedOfEmojies.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let sanitized = unidecode(asciiConvert.replace(/[\/\\'"\|#?*:•]/g, ""));
  return sanitized.trim();
};