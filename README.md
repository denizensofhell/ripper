# Ripper
**Lightweight CLI-based Youtube Downloader & Converter**  
Downloads audio and video from youtube easily via a simple command.

## Requirements
- [Node.js](https://nodejs.org/) (v18 or higher)

## Installation
```bash
git clone https://github.com/denizensofhell/ripper
cd ripper
npm install
npm install -g .
```

## Usage

Basic command syntax:

```bash
ripper <type> <url> [options]
```

| Argument | Description |
|:---------|:------------|
| `<type>` | `audio` or `video` |
| `<url>` | The youtube video URL |
| `[options]` | (Optional) Extra settings like format, output name |

## Examples

| Goal | Command |
|:-----|:--------|
| Download audio only | `ripper audio https://youtube.com/watch?v=dQw4w9WgXcQ` |
| Download video only | `ripper video https://youtube.com/watch?v=dQw4w9WgXcQ` |

## Options
You can pass extra options with flags:

| Option | Description | Example |
|:-------|:------------|:--------|
| `--format` | Choose specific format (e.g., mp3, mp4) | `--format mp3` |
| `--output` | Set custom output filename (no extension) | `--output my_song_name` |

## Download Locations

| Type | Folder |
|:-----|:-------|
| Audio | `/ripper-downloads/audio/` |
| Video | `/ripper-downloads/video/` |
| Converted Files | `/ripper-downloads/converted/` |
| Logs | `/ripper-downloads/logs/` |

## Contributing

Feel free to contribute to this project by opening issues or submitting pull requests.

## License

This project is licensed under the **MIT License** - see the LICENSE file for details.