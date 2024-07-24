#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ytdl from "@distube/ytdl-core"; // Patch for ytdl-core form the lovely folks at https://github.com/distubejs/ytdl-core
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import unidecode from 'unidecode';
import emojiStrip from 'emoji-strip';
import cp from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegStatic);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get version
const packageJsonPath = path.resolve(__dirname, './package.json');
const packageJsonData = fs.readFileSync(packageJsonPath, 'utf-8');
const packageJsonObj = JSON.parse(packageJsonData);
const version = packageJsonObj.version;

// Promisify pipeline
const promisifiedPipeline = promisify(pipeline);

// Chalk styling 
const chalkLog = console.log;

yargs(hideBin(process.argv))
  .scriptName(chalk.green("ripper"))
  .usage(chalk.yellow('Usage: $0 <command> [options]'))
  .version('v', 'Show version', chalk.magenta('ripper') + chalk.greenBright(` v${version}`))
  .command('audio', 'download audio', {
    'f': {
      alias: 'format',
      describe: 'The file format',
      choices: ['wav', 'mp3', 'aac', 'ogg', 'flac'],
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
    ripAudio(argv.url, argv.output, argv.format).catch(error => {chalkLog(chalk.bold.redBright(error.message))});
  })
  .command('video', 'download video', {
    'f': {
      alias: 'format',
      describe: 'The file format',
      choices: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv'],
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
    ripVideo(argv.url, argv.output, argv.format).catch(error => {chalkLog(chalk.bold.redBright(error.message))});
  })
  .completion()
  .epilog(chalk.yellow('Check the readme at https://github.com/denizensofhell/ripper/blob/main/README.md'))
  .parse();


function validateYTUrl(ytUrl) {
  if(!ytdl.validateURL(ytUrl)) {
    chalkLog(chalk.black.bgRed('Invalid Url'));
    return false;
  }
  return true;
}

function sanitizeFileName(title) {
  let stripedOfEmojies = emojiStrip(title);
  let asciiConvert = stripedOfEmojies.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let sanitized = unidecode(asciiConvert.replace(/[\/\\'"\|#?*:•]/g, ""));
  return sanitized.trim();
};

function getAudioCodec(filetype) {
  switch (filetype) {
    case 'wav':
      return 'pcm_s16le';
    case 'mp3':
      return 'libmp3lame';
    case 'aac':
      return 'aac';
    case 'ogg':
      return 'libvorbis';
    case 'flac':
      return 'flac';
    default:
      throw new Error(`Unsupported audio filetype: ${filetype}`);
  }
}

function getVideoCodec(filetype) {
  switch (filetype) {
    case 'mp4':
    case 'mov':
    case 'mkv':
    case 'flv':
      return 'h264';
    case 'avi':
      return 'mpeg4';
    case 'webm':
      return 'vp9';
    default:
      throw new Error(`Unsupported video filetype: ${filetype}`);
  }
}


// ************************* RIP AUDIO ************************** //
async function ripAudio(ytUrl, outputDirectory, filetype) {
  try {
    // Validate URL
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
  
    // Convert audio
    const audioCodec = getAudioCodec(filetype);

    // Download and convert
    await promisifiedPipeline(
      ffmpeg(audioStream)
        .audioCodec(audioCodec)
        .format(filetype)
        .outputOptions('-bitexact'),
      fs.createWriteStream(output)
    ).then(() => {
      progressBar.stop();
      chalkLog(chalk.greenBright(`'${title}' downloaded`) + chalk.white(` | ${output}`));
    });

  } catch (error) {
    chalkLog(chalk.bold.redBright(error.message));
  }

}

// ************************* RIP VIDEO ************************** //
async function ripVideo(ytUrl, outputDirectory, filetype) {
  try {
    // Validate URL
    if(!validateYTUrl(ytUrl)) return;

    // Get video details
    chalkLog(chalk.white('Retrieving video details...'));
    const info = await ytdl.getInfo(ytUrl);
    chalkLog(chalk.greenBright('Video details retrieved.'));
    const title = sanitizeFileName(info.videoDetails.title);

    // Set output
    const output = path.join(outputDirectory, `${title}.${filetype}`);

    // Check if file exists
    if(fs.existsSync(output)) {
      chalkLog(chalk.bold.redBright(`File already exists: ${output}`));
      return;
    }

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

    stitchWithFFMPEG(audioStream, videoStream, output, progressBar, title, filetype);
    
  } catch (error) {
    chalkLog(chalk.bold.redBright(error.message));
  }
  
}


// ************************* STITCH WITH FFMPEG ************************** //
function stitchWithFFMPEG(audioStream, videoStream, output, progressBar, title, filetype) {
  // Get video codec
  const videoCodec = getVideoCodec(filetype);
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
    '-c:v', videoCodec,
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