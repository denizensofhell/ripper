#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ytdl from "@distube/ytdl-core"; // Patch for ytdl-core from the lovely folks at https://github.com/distubejs/ytdl-core
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import unidecode from 'unidecode';
import emojiStrip from 'emoji-strip';
import cp from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import winston from 'winston';

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

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, 'ripper-downloads', 'logs', 'ripper.log'),
      options: { flags: 'w' },
    })
  ]
});

yargs(hideBin(process.argv))
  .scriptName(chalk.green("ripper"))
  .usage(chalk.yellow('Usage: $0 <command> <url> [options]'))
  .version('v', 'Show version', chalk.magenta('ripper') + chalk.greenBright(` v${version}`))
  // Rip audio
  .command('audio <url>', 'Download audio', {
    'f': {
      alias: 'format',
      describe: 'The file format',
      choices: ['wav', 'mp3', 'aac', 'ogg', 'flac'],
      default: 'mp3',
    },
    'o': {
      alias: 'output',
      describe: 'Output path',
      type: 'string',
      default: path.join(__dirname, 'ripper-downloads', 'audio'),
    }
  }, function(argv) {
    ripAudio(argv.url, argv.output, argv.format).catch(error => {
      chalkLog(chalk.bold.redBright(error.message));
    });
  })
  // Rip video
  .command('video <url>', 'Download video', {
    'f': {
      alias: 'format',
      describe: 'The file format',
      choices: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv'],
      default: 'mp4',
    },
    'o': {
      alias: 'output',
      describe: 'Output path',
      type: 'string',
      default: path.join(__dirname, 'ripper-downloads', 'video'),
    }
  }, function(argv) {
    ripVideo(argv.url, argv.output, argv.format).catch(error => {
      chalkLog(chalk.bold.redBright(error.message));
    });
  })
  // Convert file
  .command('convert <file>', 'Convert file', {
    'f': {
      alias: 'format',
      describe: 'The file format',
      choices: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'mp4', 'mkv', 'mov', 'avi', 'webm', 'flv'],
    },
    'o': {
      alias: 'output',
      describe: 'Output path',
      type: 'string',
      default: path.join(__dirname, 'ripper-downloads', 'converted'),
    }
  }, function(argv) {
    convertFile(argv.file, argv.format, argv.output).catch(error => {
      chalkLog(chalk.bold.redBright(error.message));
    });
  })
  .completion()
  .epilog(chalk.yellow('Check the readme at https://github.com/denizensofhell/ripper/blob/main/README.md'))
  .parse();

// Validate YT url
function validateYTUrl(ytUrl) {
  if(!ytdl.validateURL(ytUrl)) {
    chalkLog(chalk.black.bgRed('Invalid Url'));
    return false;
  }
  return true;
}

// Check if YT music url
function ytMusicCheck(ytUrl) {
  if(ytUrl.includes('music.youtube.com')) {
    return true;
  }
  return false;
}

// Sanitize file name
function sanitizeFileName(title) {
  let stripedOfEmojies = emojiStrip(title);
  let asciiConvert = stripedOfEmojies.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let sanitized = unidecode(asciiConvert.replace(/[\/\\'"\|#?*:•]/g, ""));
  sanitized = sanitized.replace(/["“”]/g, "");
  return sanitized.trim();
};

// Get audio codec
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
      return false;
      // throw new Error(`Unsupported audio filetype: ${filetype}`);
  }
}

// Get video codec
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
      return false;
      // throw new Error(`Unsupported video filetype: ${filetype}`);
  }
}

// ************************* RIP AUDIO ************************** //
async function ripAudio(ytUrl, outputDirectory, filetype) {
  try {
    // Validate URL
    if(!validateYTUrl(ytUrl)) return;
    
    logger.info(`Started ripping audio only from: ${ytUrl}`);

    // Need to get more info if its from youtube music
    let ytMusic = ytMusicCheck(ytUrl);

    // Get audio details
    logger.info(`Getting audio details...`);
    chalkLog(chalk.white('Retrieving audio details...'));
    const info = await ytdl.getInfo(ytUrl);
    chalkLog(chalk.greenBright('Audio details retrieved.'));
    logger.info(`Audio details retrieved for: ${info.videoDetails.title}`);
    const title = sanitizeFileName(info.videoDetails.title);
    const author = info.videoDetails.author.name.replace(' - Topic', '');

    // Set output
    let output;
    if(ytMusic) {
      output = path.join(outputDirectory, `${title} - ${author}.${filetype}`);
    } else {
      output = path.join(outputDirectory, `${title}.${filetype}`);
    }

    // Progress Bar
    const progressBar = new cliProgress.SingleBar({
      format: chalk.blue('{bar}') + '| ' + chalk.yellow('{percentage}%') + ' || {value}/{total} Chunks',
    }, cliProgress.Presets.shades_classic);
    // Set start of progress bar
    progressBar.start(1, 0);
  
    logger.info(`Starting the audio download...`);

    // Set audio stream
    const audioStream = ytdl(ytUrl, { quality: 'highestaudio' }).on('progress', (chunkLength, downloaded, total) => {
      logger.info(`Downloading audio: ${downloaded}/${total}`);
      const percent = downloaded / total;
      progressBar.update(percent);
    });
  
    // Convert audio
    logger.info(`Converting audio...`);
    const audioCodec = getAudioCodec(filetype);
    logger.info(`Audio codec: ${audioCodec}`);
    if(!audioCodec) throw new Error(`Unsupported video filetype: ${filetype}`);

    // Download and convert
    await promisifiedPipeline(
      ffmpeg(audioStream)
        .audioCodec(audioCodec)
        .format(filetype)
        .outputOptions('-bitexact'),
      fs.createWriteStream(output)
    ).then(() => {
      logger.info(`Audio converted and saved to: ${output}`);
      progressBar.stop();
      chalkLog(chalk.greenBright(`'${title} - ${author}' downloaded`) + chalk.white(` | ${output}`));
    });

  } catch (error) {
    logger.error(`Error with audio: ${error.message}`);
    chalkLog(chalk.bold.redBright(error.message));
  }
}

// ************************* RIP VIDEO ************************** //
async function ripVideo(ytUrl, outputDirectory, filetype) {
  try {
    // Validate URL
    if(!validateYTUrl(ytUrl)) return;

    const startTime = Date.now();

    logger.info(`Started ripping video from: ${ytUrl}`);

    // Need to get more info if its from youtube music
    let ytMusic = ytMusicCheck(ytUrl);

    // Get video details
    logger.info(`Getting video details...`);
    chalkLog(chalk.white('Retrieving video details...'));
    const info = await ytdl.getInfo(ytUrl);
    chalkLog(chalk.greenBright('Video details retrieved.'));
    logger.info(`Video details retrieved for: ${info.videoDetails.title}`);
    const title = sanitizeFileName(info.videoDetails.title);
    const author = info.videoDetails.author.name.replace(' - Topic', '');

    // Set output
    let output;
    if(ytMusic) {
      output = path.join(outputDirectory, `${title} - ${author}.${filetype}`);
    } else {
      output = path.join(outputDirectory, `${title}.${filetype}`);
    }

    // Check if file exists
    if(fs.existsSync(output)) {
      chalkLog(chalk.bold.redBright(`File already exists: ${output}`));
      logger.error(`File already exists: ${output}`);
      return;
    }

    // Progress Bar
    const progressBar = new cliProgress.SingleBar({
      format: chalk.blue('{bar}') + '| ' + chalk.yellow('{percentage}%') + ' || {value}/{total} Chunks',
    }, cliProgress.Presets.shades_classic);
    // Set start of progress bar
    progressBar.start(1, 0);

    logger.info(`Starting the video download...`);

    // Set video stream
    const videoStream = ytdl(ytUrl, { quality: 'highestvideo' }).on('progress', (chunkLength, downloaded, total) => {
      logger.info(`Getting video stream: ${downloaded}/${total}`);
      const percent = (downloaded / total);
      progressBar.update(percent);
    });
    
    // Set audio stream
    const audioStream = ytdl(ytUrl, { quality: 'highestaudio' }).on('progress', (chunkLength, downloaded, total) => {
      logger.info(`Getting audio stream: ${downloaded}/${total}`);
      const percent = (downloaded / total);
      progressBar.update(percent);
    });

    stitchWithFFMPEG(audioStream, videoStream, output, progressBar, title, author, filetype, startTime);
    
  } catch (error) {
    logger.error(`Error with video: ${error.message}`);
    chalkLog(chalk.bold.redBright(error.message));
  }
}

// ************************* CONVERT FILE ************************** //
async function convertFile(file, convertToExtension, outputDirectory) {
  try {

    const inputExtension = path.extname(file);
    const fileName = path.basename(file, inputExtension);
    const output = path.join(outputDirectory, `${fileName}.${convertToExtension}`);

    if(fs.existsSync(output)) {
      chalkLog(chalk.bold.redBright(`File already exists: ${output}`));
      logger.error(`File already exists: ${output}`);
      return;
    }

    if(getAudioCodec(convertToExtension)) {
      // Get audio codec
      let audioCodec = getAudioCodec(convertToExtension);

      await promisifiedPipeline(
        ffmpeg(file)
          .audioCodec(audioCodec)
          .format(convertToExtension)
          .outputOptions('-bitexact'),
        fs.createWriteStream(output)
      ).then(() => {
        logger.info(`Audio converted and saved to: ${output}`);
        chalkLog(chalk.greenBright(`'${fileName}' converted to ${convertToExtension}`) + chalk.white(` | ${output}`));
      });
      
    } 
    else if(getVideoCodec(convertToExtension)) {
      // Get video codec
      let videoCodec = getVideoCodec(convertToExtension);

      await promisifiedPipeline(
        ffmpeg(file)
          .videoCodec(videoCodec)
          .format(convertToExtension)
          .outputOptions('-bitexact'),
        fs.createWriteStream(output)
      ).then(() => {
        logger.info(`Video converted and saved to: ${output}`);
        chalkLog(chalk.greenBright(`'${fileName}' converted to ${convertToExtension}`) + chalk.white(` | ${output}`));
      });
      
    } else {
      throw new Error(`Unsupported filetype: ${inputExtension}`);
    }
    
  } catch (error) {
    logger.error(`Error with converting file: ${error.message}`);
    chalkLog(chalk.bold.redBright(error.message));
  }
}

// ************************* STITCH WITH FFMPEG ************************** //
function stitchWithFFMPEG(audioStream, videoStream, output, progressBar, title, author, filetype, startTime) {
  // Get video codec
  logger.info(`Getting video codec...`);
  const videoCodec = getVideoCodec(filetype);
  logger.info(`Video codec: ${videoCodec}`);
  if(!videoCodec) throw new Error(`Unsupported video filetype: ${filetype}`);
  // Spawn ffmpeg
  // https://github.com/fent/node-ytdl-core/blob/master/example/ffmpeg.js
  logger.info(`Spawning ffmpeg...`);
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
    // Encoding
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
  logger.info(`FFmpeg spawned`);

  // When the ffmpeg process writes to the progress pipe, update the progress bar
  ffmpegProcess.stdio[3].on('data', chunk => {
    const lines = chunk.toString().trim().split('\n');
    for (const l of lines) {
      const [key, value] = l.split('=');
      if (key.trim() === 'progress') {
        // Update progress bar based on FFmpeg progress (if available)
        const percent = parseFloat(value);
        if (!isNaN(percent)) {
          logger.info(`FFmpeg progress: ${percent}`);
          progressBar.update(percent);
        }
      }
    }
  });

  // When the ffmpeg process closes, stop the progress bar
  ffmpegProcess.on('close', () => {
    progressBar.stop();
    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);
    logger.info(`FFmpeg closed - Total time: ${totalTime}s`);
    chalkLog(chalk.greenBright(`'${title} - ${author}' downloaded`) + chalk.white(` | ${output}`));
    chalkLog(chalk.white(`Total time: ${totalTime}s`));
  });

  // When the ffmpeg process errors, stop the progress bar
  ffmpegProcess.on('error', (error) => {
    progressBar.stop();
    logger.error(`FFmpeg error: ${error.message}`);
    chalkLog(chalk.bold.redBright(`FFmpeg error: ${error.message}`));
  });

  // Call the ffmpeg process with the streams
  logger.info(`Calling ffmpeg with streams...`);
  audioStream.pipe(ffmpegProcess.stdio[4]);
  videoStream.pipe(ffmpegProcess.stdio[5]);
}