# LotPass

LotPass is a lightweight parking pass system built with GitHub Pages, Google Sheets, Google Apps Script, and optional Epson T88 receipt printing through a Raspberry Pi print bridge.

It was designed for small venues, bars, event spaces, and parking lots that need a simple way to log vehicles, collect payment during paid hours, and verify parking passes without buying a giant parking software monster.

## Live App

https://petesimple.github.io/lotpass/

## What It Does

LotPass lets customers scan a QR code, enter their license plate and vehicle info, and submit a parking request.

The system logs the request into a Google Sheet.

Staff can use the admin page to view today’s parking entries, mark parking entries as paid, print or reprint dashboard passes, void passes, manually add passes from the admin side, and verify printed passes by QR code or pass ID.

## Parking Rules

Current default logic:

    2:00 AM to 6:00 PM Central = free parking
    6:00 PM to 2:00 AM Central = paid parking

During the free parking window, submitted vehicles are automatically treated as free or comped parking.

During paid parking hours, parking is not considered valid until staff confirms payment and prints the dashboard pass.

## Pages

index.html is the main landing page for LotPass. It links to the customer parking request page, staff admin page, and pass verification page.

parking.html is the customer facing parking form. Customers enter their license plate, vehicle color, vehicle make/model, optional phone number, parking type, and optional notes.

admin.html is the staff facing admin page. Staff can load today’s parking entries, mark passes paid, print passes, reprint passes, void passes, and add a parking pass manually through an accordion section.

verify.html is the verification page. It works from a printed QR link like:

    verify.html?id=PC-20260512-0001

It can also be used manually by entering a pass ID. The page checks the Google Sheet and reports whether the pass is valid, expired, voided, unpaid, pending, or not printed.

## Backend

LotPass uses Google Sheets as the database and Google Apps Script as the service layer.

The main sheet should include these tabs:

    Parking
    Settings
    Archive

## Google Sheet Setup

The Parking tab should use these headers:

    Timestamp
    Pass ID
    Date
    Location ID
    Location Name
    Status
    Payment Status
    Print Status
    Plate
    Vehicle Color
    Vehicle Make Model
    Phone
    Parking Type
    Amount
    Payment Method
    Staff Initials
    Valid From
    Valid Until
    Printed At
    Print Count
    Voided At
    Void Reason
    Verification URL
    Notes
    Source
    Daily Phrase

The Settings tab should use settings like this:

    setting              value
    location_id          PC
    location_name        Pros and Cons
    default_amount       10
    valid_until          02:00
    free_start_time      02:00
    paid_start_time      18:00
    daily_phrase         PUCK SAFE
    parking_type_default Event Parking
    admin_pin            1234
    verify_base_url      https://petesimple.github.io/lotpass/verify.html

The Archive tab is where old parking rows are moved automatically by the archive script.

## Apps Script

The Apps Script handles customer submissions, admin list loading, mark paid, mark printed, void pass, verify pass, free parking window logic, expiration at 2:00 AM, and daily archive to the Archive tab.

After editing Apps Script, deploy it as a Web App:

    Deploy
    New deployment
    Web app
    Execute as: Me
    Who has access: Anyone

Then paste the Web App URL into:

    parking.js
    admin.js
    verify.js

## Daily Archive

The archive function moves old parking business day rows from Parking to Archive.

Run this function once manually in Apps Script to install the daily trigger:

    LP_installArchiveTrigger

The archive will then run around noon every day.

Google does not guarantee it runs exactly at 12:00:00, but it should run sometime during the noon hour.

## Optional T88 Printing

LotPass is designed to support an Epson T88 receipt printer using a Raspberry Pi print bridge.

The staff admin page can send a local print request to:

    http://PI_IP:3000/print-parking-pass

The printed dashboard pass can include the location name, plate number, vehicle info, pass ID, expiration time, daily phrase, and QR verification link.

## Print Bridge

The print bridge is a Node.js server intended to run locally on a Raspberry Pi.

Typical dependencies:

    npm init -y
    npm install express cors escpos escpos-network qrcode

Run with:

    node server.js

Or with PM2:

    pm2 start server.js --name lotpass-print-bridge
    pm2 save

## Status Values

Common Status values:

    pending
    paid
    printed
    void
    expired

Common Payment Status values:

    unpaid
    paid
    comp
    free
    free_before_open

Common Print Status values:

    not_printed
    printed
    reprinted

## Valid Pass Logic

A paid parking pass is valid when the status is not void or expired, the payment status is paid, the print status is printed or reprinted, and the Valid Until time has not passed.

A free daytime pass is valid when the status is not void or expired, the payment status is comp, free, or free_before_open, and the Valid Until time has not passed.

## Current Beta Notes

LotPass is still beta.

Current assumptions:

* The bar opens at 6:00 PM Central
* Paid parking runs from 6:00 PM to 2:00 AM
* Daytime parking is free from 2:00 AM to 6:00 PM
* Google Sheets is the source of truth
* The T88 printer is optional until the print bridge is installed
* Staff should use the admin page rather than editing the sheet directly whenever possible

## Future Ideas

Possible future improvements include a cleaner printed pass layout, logo support on printed passes, plate search on the admin page, duplicate plate warnings, payment method buttons, daily revenue summaries, multi-location support, admin activity logging, a more polished mobile layout, PWA install support, a QR code generator for signage, and a better staff handoff mode.

## Built With

* GitHub Pages
* Google Sheets
* Google Apps Script
* JavaScript
* HTML
* CSS
* Raspberry Pi
* Epson T88 receipt printer
* A suspicious amount of confidence

## License

Private/beta project unless otherwise stated.
