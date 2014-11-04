node-image-size-scanner
=======================
For a given URL, report image file sizes and paths with optional minimum file size to report on.

## Installation ##
`npm install -g node-image-size-scanner`

## Usage ##
```
$ image_check
Usage: image_check URL [min bytes for alert]
Ex: image_check http://www.google.com 1k

$ image_check www.google.com 1k
Image files > 1.00 kB (1000 bytes)
    1.83 kB http://www.google.com/images/icons/product/chrome-48.png
  209.03 kB http://www.google.com/logos/doodles/2014/halloween-2014-5647569745084416.3-hp.gif
```