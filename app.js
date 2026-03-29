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
const bookmarkBtn = document.getElementById('bookmarkBtn');
let descVisible = false; // description box hidden by default

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

// bookmark toggle to show/hide description
if(bookmarkBtn){
  // initially disabled until a page with descriptions is active
  bookmarkBtn.disabled = true;
  bookmarkBtn.classList.add('hidden');
  bookmarkBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    descVisible = !descVisible;
    bookmarkBtn.classList.toggle('active', descVisible);
    // if opening the description, remove any existing meta-frame immediately to avoid flashes
    if(descVisible){
      const mf = document.querySelector('.meta-frame');
      if(mf && mf.parentNode) mf.parentNode.removeChild(mf);
    }
    // re-render single view so description container is created/removed accordingly
    renderSingle();
    // focus textarea if visible
    if(descVisible){
      const ta = document.querySelector('.desc-container textarea');
      if(ta) ta.focus();
    }
  });
}

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
  const img = document.createElement('img');
  img.src = IMAGE_FOLDER + images[current];
  img.alt = `${COLLECTION_NAME} — page ${current + 1}`;
  wrapper.appendChild(img);

  const caption = document.createElement('div');
  caption.className = 'caption';
  caption.textContent = `${current + 1} / ${images.length}`;
  wrapper.appendChild(caption);

  // ----- Special metadata/frame for second page (index 1) -----
  // If viewing the second page, show a small metadata frame with collection details
  // only show the meta/frame when viewing page 2 and the description is NOT visible
  if(current === 1 && !descVisible){
    const meta = document.createElement('div');
    meta.className = 'meta-frame';
    // Provided context lines
    const lines = [
      'A Is For Apple Pie',
      '1880-1920',
      'textile',
      'The United States and England',
      '13.30 H x 6.80 W x 2.20 D cm (5 1/4 H x 2 11/16 W x 7/8 D in)'
    ];
    lines.forEach((t)=>{
      const p = document.createElement('div');
      p.className = 'meta-line';
      p.textContent = t;
      meta.appendChild(p);
    });
    wrapper.appendChild(meta);
    // Also ensure the description storage for this page is pre-populated with the same block
    try{
      const key = `desc:${images[current]}`;
      const existing = localStorage.getItem(key);
      const combined = lines.join('\n');
      if(!existing) localStorage.setItem(key, combined);
    }catch(_){/* ignore storage errors */}
  }

  // show editable description for pages 2..14 (1-based numbering -> indices 1..13)
  const descStart = 1;
  const descEnd = 13;
  if(current >= descStart && current <= descEnd){
    // show bookmark button for pages that support descriptions
    if(bookmarkBtn) {
      bookmarkBtn.disabled = false;
      bookmarkBtn.classList.remove('hidden');
      bookmarkBtn.classList.toggle('active', !!descVisible);
    }
    // only create and append the description container when the user has toggled it visible
    if(descVisible){
      const descWrap = document.createElement('div');
      descWrap.className = 'desc-container';
      const textarea = document.createElement('textarea');
      textarea.className = 'desc-input';
      textarea.placeholder = 'Add a description for this page...';
      // load saved description from localStorage (keyed by filename)
      try{
        const key = `desc:${images[current]}`;
        const saved = localStorage.getItem(key) || '';
        textarea.value = saved;
        // autosave on input (debounced simple)
        let t = null;
        textarea.addEventListener('input', (e)=>{
          clearTimeout(t);
          t = setTimeout(()=>{
            try{ localStorage.setItem(key, textarea.value); }catch(_){/* ignore */}
          }, 450);
        });
      }catch(_){ /* ignore storage errors */ }
      descWrap.appendChild(textarea);
      wrapper.appendChild(descWrap);
      // hide the footer/hint area when the description is visible
      if(hint) hint.classList.add('hidden');
    } else {
      if(hint) hint.classList.remove('hidden');
    }
  } else {
    if(hint) hint.classList.remove('hidden');
    if(bookmarkBtn) { bookmarkBtn.disabled = true; bookmarkBtn.classList.remove('active'); bookmarkBtn.classList.add('hidden'); }
  }

  singleView.appendChild(wrapper);

  pageIndicator.textContent = `${current + 1} / ${images.length}`;
  // with looping enabled, only disable when there are no images or a single image
  prevBtn.disabled = images.length <= 1;
  nextBtn.disabled = images.length <= 1;
}

function changeCurrent(n){
  if(images.length === 0) return;
  // wrap around
  if(n < 0) n = images.length - 1;
  if(n >= images.length) n = 0;
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
