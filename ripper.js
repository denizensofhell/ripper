#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import yargs from 'yargs';
import omelette from 'omelette';
import { hideBin } from 'yargs/helpers';
import ytdl from 'ytdl-core';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { pipeline } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pipelineAsync = promisify(pipeline);

const chalkLog = console.log;

const completion = omelette('ripper <command> <command> <command>');

completion.on('command', ({ reply }) => {
  reply(['-f', '-u', '-d', '-o']);
});
completion.init();

yargs(hideBin(process.argv))
  .scriptName(chalk.green("ripper"))
  .usage(chalk.yellow('Usage: $0 <command> [options]'))
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
    downloadAudio(argv.url, argv.output, argv.format).catch(console.error);
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
    downloadVideo(argv.url, argv.output, argv.format).catch(console.error);
  })
  .command('bpm', 'Find the BPM of a song', {
    'f': {
      alias: 'file',
      describe: 'Audio file',
      type: 'string',
      demandOption: true,
    }
  }, function(argv) {
    detectBPM(argv.file).catch(console.error);
  })
  .completion()
  .epilog(chalk.yellow('Check the readme at https://github.com/denizensofhell/ripper/blob/main/README.md'))
  .parse()

// * * * * * F U N C T I O N S * * * * *
async function downloadAudio(ytUrl, outputDirectory, filetype) {
  if(!validateYTUrl(ytUrl)) return;

  chalkLog(chalk.white('Retrieving audio details...'));
  const info = await ytdl.getInfo(ytUrl);
  chalkLog(chalk.greenBright('Audio details retrieved.'));
  const title = info.videoDetails.title.replace(/[\/\\'"\|]/g, "");
  const output = path.join(outputDirectory, `${title}.${filetype}`);
  const stream = ytdl(ytUrl, { filter: 'audioonly' });

  const progressBar = new cliProgress.SingleBar({
    format: chalk.blue('{bar}') + '| ' + chalk.yellow('{percentage}%') + ' || {value}/{total} Chunks',
  }, cliProgress.Presets.shades_classic);
  progressBar.start(1, 0);
  stream.on('progress', (chunkLength, downloaded, total) => {
    const percent = downloaded / total;
    progressBar.update(percent);
  });

  await pipelineAsync(
    ffmpeg(stream)
      .audioCodec('pcm_s16le')
      .format(filetype)
      .outputOptions('-bitexact'),
    fs.createWriteStream(output)
  ).then(() => {
    progressBar.stop();
    chalkLog(chalk.greenBright(`'${title}' downloaded`) + chalk.white(` | ${output}`));
  });
}

async function downloadVideo(ytUrl, outputDirectory, filetype) {
  chalkLog(chalk.white('Retrieving video details...'));
  const info = await ytdl.getInfo(ytUrl);
  chalkLog(chalk.greenBright('Video details retrieved.'));
  const title = info.videoDetails.title.replace(/[\/\\'"\|#]/g, "");
  const video = ytdl(ytUrl);
  const output = path.join(outputDirectory, `${title}.mp4`);

  const progressBar = new cliProgress.SingleBar({
    format: chalk.blue('{bar}') + '| ' + chalk.yellow('{percentage}%') + ' || {value}/{total} Chunks',
  }, cliProgress.Presets.shades_classic);
  progressBar.start(1, 0);
  video.on('progress', (chunkLength, downloaded, total) => {
    const percent = downloaded / total;
    progressBar.update(percent);
  });

  video.pipe(fs.createWriteStream(output)).on('finish', () => {
    progressBar.stop();
    chalkLog(chalk.greenBright(`'${title}' downloaded`) + chalk.white(` | ${output}`));
  });
}

async function detectBPM(filePath) {
  // https://www.npmjs.com/package/music-tempo
}

function validateYTUrl(ytUrl) {
  if(!ytdl.validateURL(ytUrl)) {
    chalkLog(chalk.black.bgRed('Invalid Url'));
    return false;
  }
  return true;
}