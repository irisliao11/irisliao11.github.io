# digital time capsule scrapbook

a scrapbook-style photo notebook where you freeze moments and open them later, made for anyone who wants to save memories

**live demo:** https://kaelynhe.itch.io/digital-time-capsule-scrapbook
**built by:** kaelyn he (@kaelynhe), iris liao (@irisliao11)

![screenshot of the project](screenshot.png)

## how do you use it?

- **notebook tabs:** add a moment on each tab, with a page-flip animation when flipping between them (rename and delete buttons on the side of each tab)
- **polariod photos:** upload a photo, insert a caption, and it displays on the screen as a polarioid
- **layout:** drag to move, use minus/plus buttons to resize, use corners to rotate
- **editing:** right-click a photo to edit description or delete (you can also double click to rewrite description)
- **revealing:** when it is the set date and time, the page unfreezes and lets you open the moment again
- **saving:** saved automatically (everything is stored in your browser's storage)

## how we built it

- plain HTML, CSS, and JavaScript
- localStorage to save tabs, photos, and dates

## run it yourself

1. clone the repo
2. install dependencies: `…`
3. copy `.env.example` to `.env` and fill in: `…`
4. start it: `…`

## what was hard, and how we fixed it

- flipping pages when one page is frozen caused a lag (so e looked through the code and asked claude but it didn't work so we will go through it in the future)

## what's next

- send automated message when capsule timer runs out
- add customized music to match each moment

