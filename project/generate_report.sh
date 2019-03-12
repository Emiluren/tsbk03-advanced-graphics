#!/bin/sh
pandoc --metadata pagetitle="Bonsai-simulator Xtrem" report.md -s -c buttondown.css -o report.html
