# ripper
CLI based YT Converter

### Commands:
```
  ripper audio       download audio
  ripper video       download video
  ripper bpm         Find the BPM of a song
```

## ripper audio
Download audio only from a yt url.
### Example:
`ripper audio -f wav -u https://music.youtube.com/watch?v=HZSPVVKDAPA&list=RDAMVMQmOS9tL61QE`
### Options:
```
  -f, --format   The file format              [required] [choices: "wav", "mp3"]
  -u, --url      Youtube URL                                 [string] [required]
  -o, --output   Output path
                       [string] [default: "path/to/install/ripper-downloads"]
```
## ripper video
Download video only from a yt url.
### Example:
`ripper audio -f wav -u https://music.youtube.com/watch?v=HZSPVVKDAPA&list=RDAMVMQmOS9tL61QE`
```
  -f, --format   The file format              [required] [choices: "mp4", "mkv"]
  -u, --url      Youtube URL                                 [string] [required]
  -o, --output   Output path
                       [string] [default: "path/to/install/ripper-downloads"]
```
## ripper bpm
WIP

