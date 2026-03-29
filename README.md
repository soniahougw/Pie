Museum Digital Book Viewer

Overview

A minimal static site that displays a collection of images as a simple flipbook optimized for iPad touch interactions.

Files

- index.html: Main page
- style.css: Styles
- app.js: Viewer logic and manifest
- assets/images/: Put your image files here

How to use

1. Copy your images into `assets/images/` and name them in the order you want.
2. Edit `app.js` and set the `images` array, e.g.:

   const images = ['page1.jpg','page2.jpg','page3.jpg'];

3. Open `index.html` in Safari on your iPad (you can transfer the folder to the iPad or host it on a small local server).

Collection: "A is for Apple Pie"

This workspace includes a small gallery/collection integration for the book collection "A is for Apple Pie".

How to add the actual images from your Mac

1. Run the helper script bundled in the project to copy images from your local folder and generate a manifest that the site will load:

```bash
# from project root
./copy_images.sh "/Users/sonia/Desktop/T-3202 Cotsen Book"
```

2. Start a simple HTTP server (so fetch can access assets) and open the site in your browser:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000 in your browser
```

Notes

- The script places images into `assets/images/a-is-for-apple-pie/` and writes `manifest.json` used by `app.js`.
- If you prefer to copy files manually, ensure you also create `assets/images/a-is-for-apple-pie/manifest.json` with a JSON array of filenames in display order.

To run locally on a Mac and view on an iPad connected to the same network:

- Start a simple Python server:

```bash
cd /Users/sonia/Desktop/digital-book-museum
python3 -m http.server 8000
```

- On your iPad, open Safari and visit: http://<your-mac-ip>:8000

Next steps and enhancements

- Add metadata per page (title, captions)
- Preload images and show progress
- Add better 3D page flip animations or use a canvas-based renderer
- Accessibility improvements: support screen readers and focus management
