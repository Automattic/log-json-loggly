# This repository is no longer maintained
## log-json-loggly

File tailer that captures logs with the
[log-json](https://github.com/automattic/log-json) format, and pipes
them to [Loggly](https://loggly.com).

```

  Usage: log-json-loggly [options]

  Options:

    -h, --help          output usage information
    -m, --max <events>  max number of events to buffer [20000]
    -f, --file <file>   file to read events from
    -i, --input <key>   loggly input key (required)
    -t, --tag <tag>     comma-separated tags to apply

```
