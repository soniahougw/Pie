// Viewer + gallery loader for a collection
const COLLECTION_NAME = 'A is for Apple Pie';
const IMAGE_FOLDER = 'assets/images/a-is-for-apple-pie/';

// flipbook variables (fallback)
let images = [];
const book = document.getElementById('book');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageIndicator = document.getElementById('pageIndicator');
let current = 0;

// gallery elements
const gallery = document.getElementById('gallery');
const collectionTitle = document.getElementById('collectionTitle');
const collectionStatus = document.getElementById('collectionStatus');
const singleView = document.getElementById('singleView');
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
let galleryMode = false; // when true, show single image viewer (one at a time)
const topTitle = document.querySelector('.title');
const hint = document.querySelector('.hint');

// set collection title
if(collectionTitle) collectionTitle.textContent = COLLECTION_NAME;
// Set the browser tab title to the collection name
document.title = COLLECTION_NAME;

// Try to load a manifest file from the collection folder. When working locally, run a simple server
// so fetch can access assets (e.g. python3 -m http.server)
// Intro overlay behaviour: show until tapped/clicked
const introOverlay = document.getElementById('introOverlay');
function hideIntro(){
  if(!introOverlay) return;
  introOverlay.setAttribute('aria-hidden','true');
  document.body.classList.remove('no-scroll');
}
function showIntro(){
  if(!introOverlay) return;
  introOverlay.removeAttribute('aria-hidden');
  document.body.classList.add('no-scroll');
  // when showing the intro (including after idle timeout), reset viewer to first page
  try{
    if(images && images.length > 0){
      current = 0;
      if(galleryMode) renderSingle(); else render();
    }
    // also close any open lightbox
    try{ if(lightbox && !lightbox.hidden) closeLightbox(); }catch(_){ }
  }catch(_){ /* ignore errors during intro reset */ }
}
// dismiss on click or keyboard (Enter/Space/Escape)
if(introOverlay){
  introOverlay.addEventListener('click', hideIntro);
  window.addEventListener('keydown', (e)=>{
    if(introOverlay.getAttribute('aria-hidden') === 'true') return;
    if(e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') hideIntro();
  });
  // always show intro on load (do not persist dismissed state)
  showIntro();
}

// top title click: go back to first page
if(topTitle){
  topTitle.addEventListener('click', (e)=>{
    e.preventDefault();
    // if intro shown, hide it
    try{ if(introOverlay && introOverlay.getAttribute('aria-hidden') !== 'true') hideIntro(); }catch(_){ }
    // close lightbox
    try{ if(lightbox && !lightbox.hidden) closeLightbox(); }catch(_){ }
    if(images.length === 0) return;
    if(galleryMode) changeCurrent(0); else goTo(0);
  });
}

// Bookmark/description UI removed — redesign planned

// ---------- Idle detection and confirmation overlay ----------
const idleOverlay = document.getElementById('idleOverlay');
const continueBtn = document.getElementById('continueBtn');
const idleCountdown = document.getElementById('idleCountdown');
let idleTimer = null;
let confirmTimer = null;
let countdownInterval = null;
const IDLE_MS = 60000; // time of inactivity before asking (60s)
const CONFIRM_MS = 5000; // time to wait for confirmation (5s)

function resetIdleTimer(){
  // don't start if intro visible
  try{ if(introOverlay && introOverlay.getAttribute('aria-hidden') !== 'true') return; }catch(_){ }
  if(idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(()=>{
    showIdleConfirm();
  }, IDLE_MS);
}

function showIdleConfirm(){
  if(!idleOverlay) return;
  idleOverlay.classList.remove('hidden');
  document.body.classList.add('no-scroll');
  // start countdown visible to users
  let remaining = Math.ceil(CONFIRM_MS/1000);
  if(idleCountdown) idleCountdown.textContent = `Returning to intro in ${remaining}…`;
  countdownInterval = setInterval(()=>{
    remaining -= 1;
    if(idleCountdown) idleCountdown.textContent = `Returning to intro in ${remaining}…`;
    if(remaining <= 0){
      clearInterval(countdownInterval);
    }
  }, 1000);
  // set confirm timer
  confirmTimer = setTimeout(()=>{
    // timeout -> go back to intro
    hideIdleConfirm();
    showIntro();
  }, CONFIRM_MS);
}

function hideIdleConfirm(){
  if(!idleOverlay) return;
  idleOverlay.classList.add('hidden');
  document.body.classList.remove('no-scroll');
  if(confirmTimer) { clearTimeout(confirmTimer); confirmTimer = null; }
  if(countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if(idleCountdown) idleCountdown.textContent = '';
  // restart idle detection
  resetIdleTimer();
}

// continue button handler
if(continueBtn){
  continueBtn.addEventListener('click', ()=>{
    hideIdleConfirm();
  });
}

// any user interaction resets timer
['mousemove','mousedown','touchstart','keydown','scroll','click'].forEach(ev =>{
  window.addEventListener(ev, resetIdleTimer, {passive:true});
});

// start timer now
resetIdleTimer();
fetch(IMAGE_FOLDER + 'manifest.json').then(res => {
  if(!res.ok) throw new Error('no manifest');
  return res.json();
}).then(list => {
  if(Array.isArray(list) && list.length){
    images = list.slice();
    // switch to single-image gallery mode (show one at a time)
    galleryMode = true;
    current = 0;
    if(singleView) singleView.classList.remove('hidden');
    if(gallery) gallery.classList.add('hidden');
    if(book) book.classList.add('hidden');
    if(collectionStatus) collectionStatus.textContent = `${images.length} images loaded.`;
    // still build thumbnails in the background if desired
    buildGallery();
    renderSingle();
  } else {
    // empty manifest -> fallback to flipbook and show instruction
    if(collectionStatus) collectionStatus.textContent = 'No images listed in manifest.json. Run the copy_images.sh helper or create a manifest with filenames.';
    if(gallery) gallery.classList.add('hidden');
    if(book) book.classList.remove('hidden');
    render();
  }
}).catch((err) => {
  // No manifest available or fetch failed: fallback to flipbook with helpful message
  console.warn('manifest fetch failed:', err);
  if(collectionStatus) collectionStatus.textContent = 'No manifest found. Run `./copy_images.sh "/path/to/source"` from the project root to import images.';
  if(gallery) gallery.classList.add('hidden');
  if(book) book.classList.remove('hidden');
  images = [];
  render();
});

/* ---------- Single-image viewer ---------- */
function renderSingle(){
  if(!singleView) return;
  singleView.innerHTML = '';
  if(images.length === 0){
    const msg = document.createElement('div');
    msg.textContent = 'No images to display.';
    msg.style.padding = '20px';
    singleView.appendChild(msg);
    pageIndicator.textContent = `0 / 0`;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'single-inner';
  // if this page will show a bottom description (pages 2-7), anchor content to bottom
  if(current >= 1 && current <= 6){
    wrapper.classList.add('has-bottom-desc');
  } else {
    wrapper.classList.remove('has-bottom-desc');
  }
  const img = document.createElement('img');
  img.src = IMAGE_FOLDER + images[current];
  img.alt = `${COLLECTION_NAME} — page ${current + 1}`;
  // For page 2 (index 1) show a slightly smaller image so the description below fits
  if(current === 1){
    img.style.maxHeight = '62vh';
    img.style.width = 'auto';
    img.style.objectFit = 'contain';
  } else {
    // reset any inline styles for other pages
    img.style.maxHeight = '';
    img.style.width = '';
    img.style.objectFit = '';
  }
  wrapper.appendChild(img);

  const caption = document.createElement('div');
  caption.className = 'caption';
  caption.textContent = `${current + 1} / ${images.length}`;
  wrapper.appendChild(caption);

  // Add a static descriptive block under the image for the second page (index 1)
  if(current === 1){
    const desc = document.createElement('div');
    desc.className = 'page-desc';
    desc.classList.add('no-bg');
    desc.innerText = `The front cover is adorned with a faded cloth image of an apple pie, the back cover features a cloth image of a Black child, and the inner pages tell the story of a Black child interacting with an apple pie: for example, "B - Bit it," and "C - Cut it." Most of the book's cover and pages are made of linen and cotton. The spine is made of velvet, and the back cover uses a bit of handmade lace. Most of the cloth is made with a plain weave, but the cover material uses a satin weave.`;
    wrapper.appendChild(desc);
  }

  // Add a static descriptive block under the image for the third page (index 2)
  if(current === 2){
    const desc3 = document.createElement('div');
    desc3.className = 'page-desc';
    desc3.classList.add('no-bg');
    desc3.innerText = `The book is hand-stitched. Much of the stitching is neat and uniform, but certain areas (the inside of the covers) use larger, messier stitches (handmade).`;
  if(current >= 2 && current <= 15 && current !== 6) desc3.classList.add('fixed-at-66');
    wrapper.appendChild(desc3);
  }

  // Add a static descriptive block under the image for the fifth page (index 4)
  if(current === 4){
    const desc5 = document.createElement('div');
    desc5.className = 'page-desc';
    desc5.classList.add('no-bg');
    desc5.innerText = `The A was an Apple Pie alphabet rhyme that can be traced back to 17th century England, but remained popular into the 20th century. Some of the usual narrative has been changed in this apple pie booklet. Instead of "Dealt it" and "Eat it" this book says "Danced for it" and "Exclaimed at it." These adjustments could serve to further the racial stereotypes the book depicts — dancing, especially, is a minstrel trope.`;
  if(current >= 2 && current <= 15 && current !== 6) desc5.classList.add('fixed-at-66');
    wrapper.appendChild(desc5);
  }

  // Add a static descriptive block under the image for the sixth page (index 5)
  if(current === 5){
    const desc6 = document.createElement('div');
    desc6.className = 'page-desc';
    desc6.classList.add('no-bg');
    desc6.innerText = `The typical minstrel performer would don blackface, darkened to the extreme, with red paint around the lips — these characteristics are present in the apple pie book. Based on this minstrel history and the type of imagery in the apple pie book, we can fairly confidently narrow the timeframe in which the book was made to about 1880-1920 (post Civil War and pre WWII), when popular culture was most heavily saturated with this type of imagery.`;
  if(current >= 2 && current <= 15 && current !== 6) desc6.classList.add('fixed-at-66');
    wrapper.appendChild(desc6);
  }

  // Add an icon-button which toggles a pop-out description on the seventh page (index 6)
  if(current === 6){
    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'page-toggle';

    const btn = document.createElement('button');
    btn.className = 'icon-button';
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Show FDR note');

    const icon = document.createElement('img');
    // use the provided file from the collection folder
    icon.src = IMAGE_FOLDER + 'FDR 1.png';
    icon.alt = 'FDR image';
    btn.appendChild(icon);

  const desc7 = document.createElement('div');
  // make the NPR citation its own third line and right-align the block
    desc7.className = 'page-desc collapsed';
    desc7.classList.add('no-bg');
    desc7.innerHTML = `
      <div class="desc-main">During the Great Depression, Barnes notes that President Franklin D. Roosevelt's Works Progress Administration sought to "preserve American heritage" by promoting blackface.</div>
      <div class="desc-cite">-NPR Article: This historian dug up the hidden history of 'amateur' blackface in America</div>
    `;
  // keep page 7's pop-out description in-flow (beside the button) rather than fixed at 66vh
  if(current >= 2 && current <= 15 && current !== 6) desc7.classList.add('fixed-at-66');

    function toggleDesc7(){
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      desc7.classList.toggle('collapsed');
      // ensure style state for older browsers
      if(desc7.classList.contains('collapsed')){
        desc7.style.display = 'none';
      } else {
        desc7.style.display = '';
      }
      // reset idle timer so it doesn't immediately return to intro while reading
      try{ resetIdleTimer(); }catch(_){ }
    }
    btn.addEventListener('click', toggleDesc7);
    // also handle touchstart for better responsiveness on mobile and keyboard
    btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); toggleDesc7(); });
    btn.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDesc7(); } });

    toggleWrap.appendChild(btn);
    toggleWrap.appendChild(desc7);
    // lower the toggle so it sits below the main image area (below ~68% of viewport)
    toggleWrap.classList.add('lowered-toggle');
    wrapper.appendChild(toggleWrap);
  }

  // Add an icon-button which toggles a description below the image on the eighth page (index 7)
  if(current === 7){
    const toggleWrap8 = document.createElement('div');
  // use the inline/default row layout so the description appears beside the button
  toggleWrap8.className = 'page-toggle';

    const btn8 = document.createElement('button');
    btn8.className = 'icon-button';
    btn8.type = 'button';
    btn8.setAttribute('aria-expanded', 'false');
    btn8.setAttribute('aria-label', 'Show banjo note');

    const icon8 = document.createElement('img');
    // use the provided file from the collection folder
    icon8.src = IMAGE_FOLDER + 'Banjo.png';
    icon8.alt = 'Banjo image';
    btn8.appendChild(icon8);

    const desc8 = document.createElement('div');
    // the description is initially collapsed/hidden and will appear under the button
    desc8.className = 'page-desc collapsed';
    desc8.classList.add('no-bg');
    desc8.innerHTML = `
      <div class="desc-main">Ties to music (songs → dance → blackface shows); “What's interesting about those songs is they are romanticizing the relationship between an enslaved person and their enslaver. And so when we have commentary, even from the president now, who recently said slavery wasn't so bad, well, slavery was horrific, but if you were raised on a diet of Stephen Foster music, and going to minstrel shows, you can somewhat understand how somebody at the time could easily be led to believe that slavery was a grand old party because that's what it was supposed to be telling you. It's pro-slavery propaganda.”</div>
      <div class="desc-cite">-NPR Article: This historian dug up the hidden history of 'amateur' blackface in America</div>
    `;

    function toggleDesc8(){
      const expanded = btn8.getAttribute('aria-expanded') === 'true';
      btn8.setAttribute('aria-expanded', String(!expanded));
      desc8.classList.toggle('collapsed');
      if(desc8.classList.contains('collapsed')){
        desc8.style.display = 'none';
      } else {
        desc8.style.display = '';
      }
      try{ resetIdleTimer(); }catch(_){ }
    }
    btn8.addEventListener('click', toggleDesc8);
    btn8.addEventListener('touchstart', (e)=>{ e.preventDefault(); toggleDesc8(); });
    btn8.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDesc8(); } });

    toggleWrap8.appendChild(btn8);
    toggleWrap8.appendChild(desc8);
    // lower the toggle for page 8 as well so icon sits below ~68% of viewport
    toggleWrap8.classList.add('lowered-toggle');
    wrapper.appendChild(toggleWrap8);
  }

  // no per-page descriptions for now — always show hint/footer
  if(hint) hint.classList.remove('hidden');

  singleView.appendChild(wrapper);

  pageIndicator.textContent = `${current + 1} / ${images.length}`;
  // with looping enabled, only disable when there are no images or a single image
  // hide previous button on the first page so the arrow shape isn't visible
  const prevHidden = images.length <= 1 || current === 0;
  prevBtn.disabled = prevHidden;
  prevBtn.classList.toggle('hidden', prevHidden);
  try{ prevBtn.setAttribute('aria-disabled', prevHidden ? 'true' : 'false'); }catch(_){ }

  nextBtn.disabled = images.length <= 1;
}

function changeCurrent(n){
  if(images.length === 0) return;
  // clamp at start (do not wrap backward from first page), but allow forward wrap
  if(n < 0) n = 0;
  if(n >= images.length) n = 0; // keep forward wrap to first
  current = n;
  renderSingle();
}

/* ---------- Gallery logic (simple grid + lightbox) ---------- */
function buildGallery(){
  if(!gallery) return;
  gallery.innerHTML = '';
  images.forEach((name, i) =>{
    const thumb = document.createElement('button');
    thumb.className = 'thumb';
    thumb.setAttribute('aria-label', `Open page ${i+1}`);
    const img = document.createElement('img');
    img.src = IMAGE_FOLDER + name;
    img.alt = `${COLLECTION_NAME} — page ${i+1}`;
    thumb.appendChild(img);
    thumb.addEventListener('click', () => openLightbox(i));
    gallery.appendChild(thumb);
  });
}

let currentLightboxIndex = -1;
function openLightbox(index){
  const name = images[index];
  if(!name) return;
  currentLightboxIndex = index;
  lbImg.src = IMAGE_FOLDER + name;
  lbImg.alt = `${COLLECTION_NAME} — page ${index+1}`;
  lightbox.hidden = false;
}

function closeLightbox(){
  lightbox.hidden = true;
  lbImg.src = '';
  lbImg.alt = '';
  currentLightboxIndex = -1;
}

lightbox.addEventListener('click', (e)=>{ if(e.target === lightbox) closeLightbox(); });

function lightboxNext(){
  if(images.length === 0) return;
  const next = (currentLightboxIndex + 1) % images.length;
  openLightbox(next);
}
function lightboxPrev(){
  if(images.length === 0) return;
  const prev = (currentLightboxIndex - 1 + images.length) % images.length;
  openLightbox(prev);
}

// Keyboard navigation for lightbox (Esc to close, ← / → to navigate)
window.addEventListener('keydown', (e) => {
  if(!lightbox || lightbox.hidden) return;
  if(e.key === 'Escape') closeLightbox();
  if(e.key === 'ArrowRight') lightboxNext();
  if(e.key === 'ArrowLeft') lightboxPrev();
});

/* ---------- Flipbook fallback (kept mostly as before) ---------- */
function render() {
  book.innerHTML = '';
  const inner = document.createElement('div');
  inner.className = 'book-inner';

  const prevIndex = Math.max(0, current - 1);
  const nextIndex = Math.min(images.length - 1, current + 1);

  const prevPage = createPage(prevIndex, 'prev');
  const currPage = createPage(current, 'current');
  const nextPage = createPage(nextIndex, 'next');

  inner.appendChild(prevPage);
  inner.appendChild(currPage);
  inner.appendChild(nextPage);
  book.appendChild(inner);

  pageIndicator.textContent = `${current + 1} / ${Math.max(1, images.length)}`;

  // with looping enabled, only disable when there are no images or a single image
  prevBtn.disabled = images.length <= 1;
  nextBtn.disabled = images.length <= 1;
}

function createPage(index, cls){
  const page = document.createElement('section');
  page.className = `page ${cls}`;
  if(images.length === 0){
    const empty = document.createElement('div');
    empty.textContent = 'No images yet. Run the included copy_images.sh script to import images from your workstation into assets/images/a-is-for-apple-pie and generate a manifest.';
    empty.style.padding = '20px';
    empty.style.textAlign = 'center';
    page.appendChild(empty);
    return page;
  }
  const img = document.createElement('img');
  img.src = `${IMAGE_FOLDER}${images[index]}`;
  img.alt = `Page ${index + 1}`;
  page.appendChild(img);
  return page;
}

function goTo(n){
  if(images.length === 0) return;
  // wrap around
  if(n < 0) n = images.length - 1;
  if(n >= images.length) n = 0;
  const inner = document.querySelector('.book-inner');
  const curr = inner.querySelector('.page.current');
  const targetDir = n > current ? 'next' : 'prev';
  current = n;

  // animate
  if(targetDir === 'next'){
    curr.classList.add('flip-next');
  } else {
    curr.classList.add('flip-prev');
  }

  // after animation, re-render
  setTimeout(render, 650);
}

prevBtn.addEventListener('click', () => {
  if(galleryMode) changeCurrent(current - 1); else goTo(current - 1);
});
nextBtn.addEventListener('click', () => {
  if(galleryMode) changeCurrent(current + 1); else goTo(current + 1);
});

// touch/swipe support
let touchStartX = 0;
let touchEndX = 0;

book.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, {passive:true});
book.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleGesture();
}, {passive:true});
// also attach touch support to singleView when in galleryMode
if(singleView){
  singleView.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, {passive:true});
  singleView.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleGesture();
  }, {passive:true});
}

function handleGesture(){
  const dx = touchEndX - touchStartX;
  if(Math.abs(dx) < 30) return;
  if(dx < 0){
    if(galleryMode) changeCurrent(current + 1); else goTo(current + 1);
  } else {
    if(galleryMode) changeCurrent(current - 1); else goTo(current - 1);
  }
}

// keyboard
window.addEventListener('keydown', (e) => {
  // if lightbox is open, the other key handler handles navigation
  if(lightbox && !lightbox.hidden) return;
  if(e.key === 'ArrowLeft'){
    if(galleryMode) changeCurrent(current - 1); else goTo(current - 1);
  }
  if(e.key === 'ArrowRight'){
    if(galleryMode) changeCurrent(current + 1); else goTo(current + 1);
  }
});

// Initialize (render will be called after manifest fetch resolves or in fallback)
