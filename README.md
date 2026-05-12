# LotPass

LotPass is a lightweight parking pass system built with GitHub Pages, Google Sheets, Google Apps Script, and optional Epson T88 receipt printing through a Raspberry Pi print bridge.

It was designed for small venues, bars, event spaces, and parking lots that need a simple way to log vehicles, collect payment during paid hours, and verify parking passes without buying a giant parking software monster.

## Live App

Main page:

https://petesimple.github.io/lotpass/

## What It Does

LotPass lets customers scan a QR code, enter their license plate and vehicle info, and submit a parking request.

The system logs the request into a Google Sheet.

Staff can then use the admin page to:

* View today’s parking entries
* Mark a parking entry as paid
* Print or reprint a dashboard pass
* Void a pass
* Manually add a pass from the admin side
* Verify a printed pass by QR code or pass ID

## Parking Rules

The current default logic is:

```text
2:00 AM to 6:00 PM Central = free parking
6:00 PM to 2:00 AM Central = paid parking
