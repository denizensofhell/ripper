# Ripper

**Ripper** is a command-line utility for downloading audio and video from yt.

## Installation
Make sure you have **Node.js** installed on your system. Then, you can install Ripper globally using npm:
`npm install -g ripper`

## Usage

### Commands

- `ripper audio`: Download audio from a YouTube URL.
- `ripper video`: Download video from a YouTube URL.
- `ripper bpm`: Find the BPM of a song.

### Examples

#### Download Audio

`ripper audio -f wav -u https://music.youtube.com/watch?v=HZSPVVKDAPA&list=RDAMVMQmOS9tL61QE`

Options:
- `-f, --format`: The file format (choices: “wav”, “mp3”).
- `-u, --url`: YouTube URL.
- `-o, --output`: Output path (default: “path/to/install/ripper-downloads”).

#### Download Video

`ripper video -f mp4 -u https://music.youtube.com/watch?v=HZSPVVKDAPA&list=RDAMVMQmOS9tL61QE`

Options:
- `-f, --format`: The file format (choices: “mp4”, “mkv”).
- `-u, --url`: YouTube URL.
- `-o, --output`: Output path (default: “path/to/install/ripper-downloads”).

## Contributing

Feel free to contribute to this project by opening issues or submitting pull requests.

## License

This project is licensed under the **MIT License** - see the LICENSE file for details.