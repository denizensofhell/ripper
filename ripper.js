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

const args = yargs(hideBin(process.argv))
  .scriptName(chalk.green("ripper"))
  .usage(chalk.yellow('Usage: $0 <command> [options]'))
  .option('f', {
    alias: 'format',
    describe: 'The file format',
    choices: ['wav', 'mp3'],
    demandOption: true,
  })
  .option('u', {
    alias: 'url',
    describe: 'Youtube URL',
    type: 'string',
    demandOption: true,
  })
  .option('d', {
    alias: 'downloadType',
    describe: 'Download type',
    choices: ['audio', 'video'],
    demandOption: true,
  })
  .option('o', {
    alias: 'output',
    describe: 'Output path (Default ripper-downloads)',
    type: 'string',
    default: path.join(__dirname, 'ripper-downloads'),
  })
  .completion()
  .help(chalk.green('h'))
  .alias('h', 'help')
  .epilog(chalk.yellow('For more information, find our manual at https://github.com/denizensofhell/ripper/blob/main/README.md'))
  .parse()

if(args.downloadType === 'audio') {
  downloadAudio(args.url, args.output, args.format).catch(console.error);
} 
else if (args.downloadType === 'video') {
  console.log('video');
}

// * * * * * F U N C T I O N S * * * * *
async function downloadAudio(ytUrl, outputDirectory, filetype) {
  chalkLog(chalk.magenta('Retrieving audio details...'));
  const info = await ytdl.getInfo(ytUrl);
  chalkLog(chalk.greenBright('Audio details retrieved.'));
  const title = info.videoDetails.title.replace(/[\/\\'"\|]/g, "");
  const stream = ytdl(ytUrl, { filter: 'audioonly' });

  const progressBar = new cliProgress.SingleBar({
    format: chalk.magenta('{bar}') + '| {percentage}% || {value}/{total} Chunks',
  }, cliProgress.Presets.shades_classic);
  progressBar.start(1, 0);
  stream.on('progress', (chunkLength, downloaded, total) => {
    const percent = downloaded / total;
    progressBar.update(percent);
  });

  const output = path.join(outputDirectory, `${title}.${filetype}`);

  await pipelineAsync(
    ffmpeg(stream)
      .audioCodec('pcm_s16le')
      .format(filetype)
      .outputOptions('-bitexact'),
    fs.createWriteStream(output)
  ).then(() => {
    progressBar.stop();
    chalkLog(chalk.greenBright(`'${title}.${filetype}' has been downloaded`));
  });
}