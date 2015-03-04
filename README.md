node-image-size-scanner
=======================
For a given URL, report image file sizes and paths. Optionally you may specify a minimum file size to report on. Formatted output or json output.

## Installation ##
`npm install -g node-image-size-scanner`

## Usage ##
```
$ image_check
Usage: image_check -u URL [-b MIN_BYTES_TO_ALERT_ON] [-j|-json]
Ex: image_check -u http://www.google.com -b 1k
```
### Formatted Output ###
```
$ image_check -u http://www.google.com -b 1k
Image files > 1.00 kB (1000 bytes)
    8.23 kB https://www.google.com/images/srpr/logo9w.png
    1.83 kB https://www.google.com/images/icons/product/chrome-48.png
```
### JSON output
```
$ image_check -u https://www.google.com -b 1k -j
{ url: 'https://www.google.com',
  byte_threshold: 1000,
  images:
   [ { image_url: 'https://www.google.com/images/srpr/logo9w.png',
       bytes: 8228 },
     { image_url: 'https://www.google.com/images/icons/product/chrome-48.png',
       bytes: 1834 } ] }
```