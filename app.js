// Viewer + gallery loader for a collection
const COLLECTION_NAME = 'A is for Apple Pie';
const IMAGE_FOLDER = 'assets/images/a-is-for-apple-pie/';

// UI configuration: number of words to group per logical line when wrapping descriptions
const WORDS_PER_LINE = 10;

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
  // expose the current page index as a data attribute so CSS can target page-specific
  // selectors (useful for making page 10 toggles default to the lowered position)
  wrapper.setAttribute('data-page', String(current));
  // if this page will show a bottom description (pages 2-7), anchor content to bottom
  if(current >= 1 && current <= 6){
    wrapper.classList.add('has-bottom-desc');
  } else {
    wrapper.classList.remove('has-bottom-desc');
  }
  // render the main image. Use the manifest entry for the current page so
  // page ordering remains driven by `manifest.json` (page 3 will load
  // `T-3202.A.png` as listed in the manifest).
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
  // We want to split description into two columns with up to 10 words per line.
  const text = `The front cover is adorned with a faded cloth image of an apple pie, the back cover features a cloth image of a Black child, and the inner pages tell the story of a Black child interacting with an apple pie: for example, "B - Bit it," and "C - Cut it." Most of the book's cover and pages are made of linen and cotton. The spine is made of velvet, and the back cover uses a bit of handmade lace. Most of the cloth is made with a plain weave, but the cover material uses a satin weave.`;

    const desc = document.createElement('div');
    desc.className = 'page-desc split-columns';
    desc.classList.add('no-bg');

    // split into words, group into lines of up to WORDS_PER_LINE words
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    for(let i = 0; i < words.length; i += WORDS_PER_LINE){
      lines.push(words.slice(i, i + WORDS_PER_LINE).join(' '));
    }

    // If the description generates 5 lines or fewer, keep it as a single block.
    // Otherwise split into two roughly equal halves for left and right columns.
    if(lines.length <= 5){
      // Render as explicit lines (one <p> per logical line) so the 10-words
      // grouping is visible even when we don't split into two columns.
      lines.forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        desc.appendChild(p);
      });
    } else {
      const half = Math.ceil(lines.length / 2);
      const leftLines = lines.slice(0, half);
      const rightLines = lines.slice(half);

      const left = document.createElement('div');
      left.className = 'desc-left';
      leftLines.forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        left.appendChild(p);
      });

      const right = document.createElement('div');
      right.className = 'desc-right';
      rightLines.forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        right.appendChild(p);
      });

      desc.appendChild(left);
      desc.appendChild(right);
    }
    wrapper.appendChild(desc);
  }

  // Add a static descriptive block under the image for the third page (index 2)
  if(current === 2){
    const text3 = `The book is hand-stitched. Much of the stitching is neat and uniform, but certain areas (the inside of the covers) use larger, messier stitches (handmade).`;
    const desc3 = document.createElement('div');
    desc3.className = 'page-desc';
    desc3.classList.add('no-bg');

    // split into words, group into lines of up to WORDS_PER_LINE words
    const words3 = text3.split(/\s+/).filter(Boolean);
    const lines3 = [];
    for(let i = 0; i < words3.length; i += WORDS_PER_LINE){
      lines3.push(words3.slice(i, i + WORDS_PER_LINE).join(' '));
    }

    if(lines3.length <= 5){
      // render explicit logical lines so grouping is visible
      lines3.forEach(line => { const p = document.createElement('p'); p.textContent = line; desc3.appendChild(p); });
    } else {
      // split into two columns
      desc3.classList.add('split-columns');
      const half3 = Math.ceil(lines3.length / 2);
      const leftLines3 = lines3.slice(0, half3);
      const rightLines3 = lines3.slice(half3);
      const left3 = document.createElement('div'); left3.className = 'desc-left';
      leftLines3.forEach(line => { const p = document.createElement('p'); p.textContent = line; left3.appendChild(p); });
      const right3 = document.createElement('div'); right3.className = 'desc-right';
      rightLines3.forEach(line => { const p = document.createElement('p'); p.textContent = line; right3.appendChild(p); });
      desc3.appendChild(left3);
      desc3.appendChild(right3);
    }
    if(current >= 2 && current <= 15 && current !== 6) desc3.classList.add('fixed-at-66');
    wrapper.appendChild(desc3);
  }

  // Add a static descriptive block under the image for the fourth page (index 3)
  if(current === 3){
    const text4 = `The A was an Apple Pie alphabet rhyme that can be traced back to 17th century England, but remained popular into the 20th century.`;
    const desc4 = document.createElement('div');
    desc4.className = 'page-desc';
    desc4.classList.add('no-bg');

    const words4 = text4.split(/\s+/).filter(Boolean);
    const lines4 = [];
    for(let i = 0; i < words4.length; i += WORDS_PER_LINE){
      lines4.push(words4.slice(i, i + WORDS_PER_LINE).join(' '));
    }
    if(lines4.length <= 5){
      lines4.forEach(line => { const p = document.createElement('p'); p.textContent = line; desc4.appendChild(p); });
    } else {
      desc4.classList.add('split-columns');
      const half4 = Math.ceil(lines4.length / 2);
      const leftLines4 = lines4.slice(0, half4);
      const rightLines4 = lines4.slice(half4);
      const left4 = document.createElement('div'); left4.className = 'desc-left';
      leftLines4.forEach(line => { const p = document.createElement('p'); p.textContent = line; left4.appendChild(p); });
      const right4 = document.createElement('div'); right4.className = 'desc-right';
      rightLines4.forEach(line => { const p = document.createElement('p'); p.textContent = line; right4.appendChild(p); });
      desc4.appendChild(left4);
      desc4.appendChild(right4);
    }
    if(current >= 2 && current <= 15 && current !== 6) desc4.classList.add('fixed-at-66');
    wrapper.appendChild(desc4);
  }

  // Add a static descriptive block under the image for the fifth page (index 4)
  if(current === 4){
    const text5 = `Some of the usual narrative has been changed in this apple pie booklet. Instead of "Dealt it" and "Eat it" this book says "Danced for it" and "Exclaimed at it." These adjustments could serve to further the racial stereotypes the book depicts — dancing, especially, is a minstrel trope.`;
    const desc5 = document.createElement('div');
    desc5.className = 'page-desc';
    desc5.classList.add('no-bg');

    const words5 = text5.split(/\s+/).filter(Boolean);
    const lines5 = [];
    for(let i = 0; i < words5.length; i += WORDS_PER_LINE){
      lines5.push(words5.slice(i, i + WORDS_PER_LINE).join(' '));
    }
    if(lines5.length <= 5){
      lines5.forEach(line => { const p = document.createElement('p'); p.textContent = line; desc5.appendChild(p); });
    } else {
      desc5.classList.add('split-columns');
      const half5 = Math.ceil(lines5.length / 2);
      const leftLines5 = lines5.slice(0, half5);
      const rightLines5 = lines5.slice(half5);
      const left5 = document.createElement('div'); left5.className = 'desc-left';
      leftLines5.forEach(line => { const p = document.createElement('p'); p.textContent = line; left5.appendChild(p); });
      const right5 = document.createElement('div'); right5.className = 'desc-right';
      rightLines5.forEach(line => { const p = document.createElement('p'); p.textContent = line; right5.appendChild(p); });
      desc5.appendChild(left5);
      desc5.appendChild(right5);
    }
  if(current >= 2 && current <= 15 && current !== 6) desc5.classList.add('fixed-at-66');
    wrapper.appendChild(desc5);
  }

  // Add a static descriptive block under the image for the sixth page (index 5)
  if(current === 5){
  const text6 = `The typical minstrel performer would don blackface, darkened to the extreme, with red paint around the lips — these characteristics are present in the apple pie book. Based on this minstrel history and the type of imagery in the apple pie book, we can fairly confidently narrow the timeframe in which the book was made to about 1880-1920 (post Civil War and pre WWII), when popular culture was most heavily saturated with this type of imagery.`;
    const desc6 = document.createElement('div');
    desc6.className = 'page-desc';
    desc6.classList.add('no-bg');

    const words6 = text6.split(/\s+/).filter(Boolean);
    const lines6 = [];
    for(let i = 0; i < words6.length; i += WORDS_PER_LINE){
      lines6.push(words6.slice(i, i + WORDS_PER_LINE).join(' '));
    }
    if(lines6.length <= 5){
      lines6.forEach(line => { const p = document.createElement('p'); p.textContent = line; desc6.appendChild(p); });
    } else {
      desc6.classList.add('split-columns');
      const half6 = Math.ceil(lines6.length / 2);
      const leftLines6 = lines6.slice(0, half6);
      const rightLines6 = lines6.slice(half6);
      const left6 = document.createElement('div'); left6.className = 'desc-left';
      leftLines6.forEach(line => { const p = document.createElement('p'); p.textContent = line; left6.appendChild(p); });
      const right6 = document.createElement('div'); right6.className = 'desc-right';
      rightLines6.forEach(line => { const p = document.createElement('p'); p.textContent = line; right6.appendChild(p); });
      desc6.appendChild(left6);
      desc6.appendChild(right6);
    }
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

    // create an icon box that holds the button and a label beneath it
    const iconBox = document.createElement('div');
    iconBox.className = 'icon-box';
    iconBox.appendChild(btn);
    const label7 = document.createElement('div');
    label7.className = 'icon-label';
    label7.textContent = 'FDR President';
    iconBox.appendChild(label7);

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

  toggleWrap.appendChild(iconBox);
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

  // create icon box + label for page 8
  const iconBox8 = document.createElement('div');
  iconBox8.className = 'icon-box';
  iconBox8.appendChild(btn8);
  const label8 = document.createElement('div');
  label8.className = 'icon-label';
  label8.textContent = 'Stephen Foster';
  iconBox8.appendChild(label8);

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

  toggleWrap8.appendChild(iconBox8);
  toggleWrap8.appendChild(desc8);
    // lower the toggle for page 8 as well so icon sits below ~68% of viewport
    toggleWrap8.classList.add('lowered-toggle');
    wrapper.appendChild(toggleWrap8);
  }

    // Add an icon-button which toggles a description below the image on the ninth page (index 8)
    if(current === 8){
      const toggleWrap9 = document.createElement('div');
    // use the inline/default row layout so the description appears beside the button
    toggleWrap9.className = 'page-toggle';

      const btn9 = document.createElement('button');
      btn9.className = 'icon-button';
      btn9.type = 'button';
      btn9.setAttribute('aria-expanded', 'false');
      btn9.setAttribute('aria-label', 'Show show-1 note');

      const icon9 = document.createElement('img');
      icon9.src = IMAGE_FOLDER + 'show 1.png';
      icon9.alt = 'Show 1 image';
      btn9.appendChild(icon9);

    // create icon box + label for page 9
    const iconBox9 = document.createElement('div');
    iconBox9.className = 'icon-box';
    iconBox9.appendChild(btn9);
    const label9 = document.createElement('div');
    label9.className = 'icon-label';
    label9.textContent = 'Minstrel Show';
    iconBox9.appendChild(label9);

    const desc9 = document.createElement('div');
      desc9.className = 'page-desc collapsed';
      desc9.classList.add('no-bg');
      desc9.innerHTML = `
        <div class="desc-main">"Make America Great Again" or "This Is Our Country" or "Take Back Our Country" are all slogans and songs that were very common in minstrel shows. And so a lot of minstrel shows reinterpreted slavery in a fantastical way, that the Civil War ended and that in these minstrel shows there was Black rule and that everything America held dear was desecrated. And so this [blackface] "Zip" character … sometimes he's named "Rastus" — he has different names that he goes by — runs for office, political office, becomes president, and the first thing he does is he takes away America's guns. Sound familiar? And so a lot of these terms that you could perhaps say [are] dog whistles in white of supremacy are taken line for line from these minstrel shows.</div>
        <div class="desc-cite">-NPR Article: This historian dug up the hidden history of 'amateur' blackface in America</div>
      `;

      function toggleDesc9(){
        const expanded = btn9.getAttribute('aria-expanded') === 'true';
        btn9.setAttribute('aria-expanded', String(!expanded));
        desc9.classList.toggle('collapsed');
        if(desc9.classList.contains('collapsed')){
          desc9.style.display = 'none';
        } else {
          desc9.style.display = '';
        }
        try{ resetIdleTimer(); }catch(_){ }
      }
      btn9.addEventListener('click', toggleDesc9);
      btn9.addEventListener('touchstart', (e)=>{ e.preventDefault(); toggleDesc9(); });
      btn9.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDesc9(); } });

    toggleWrap9.appendChild(iconBox9);
    toggleWrap9.appendChild(desc9);
      // lower the toggle for page 9 as well so icon sits below ~68% of viewport
      toggleWrap9.classList.add('lowered-toggle');
      wrapper.appendChild(toggleWrap9);
    }

    // Add an icon-button which toggles a description on the eleventh page (index 10)
    if(current === 10){
      const toggleWrap10 = document.createElement('div');
  // use the inline/default row layout so the description appears beside the button (match page 9)
  toggleWrap10.className = 'page-toggle';

      const btn10 = document.createElement('button');
      btn10.className = 'icon-button';
      btn10.type = 'button';
      btn10.setAttribute('aria-expanded', 'false');
      btn10.setAttribute('aria-label', 'Show PTA note');

      const icon10 = document.createElement('img');
      icon10.src = IMAGE_FOLDER + 'pta.png';
      icon10.alt = 'PTA image';
      btn10.appendChild(icon10);

    // create icon box + label for page 10
    const iconBox10 = document.createElement('div');
    iconBox10.className = 'icon-box';
    iconBox10.appendChild(btn10);
    const label10 = document.createElement('div');
    label10.className = 'icon-label';
    label10.textContent = 'History Fact';
    iconBox10.appendChild(label10);

    const desc10 = document.createElement('div');
      desc10.className = 'page-desc collapsed';
      desc10.classList.add('no-bg');
      desc10.innerHTML = `
        <div class="desc-main">Betty Reid, who had just integrated this neighborhood and her son integrated Park Mead Elementary, is horrified to discover that the first thing that her son is supposed to witness is a blackface show put on by the school principal and the PTA. And the show that they're doing is actually one of the shows that was recommended by the WPA, written and created by the WPA, called "Weep No More," which is from a Stephen Foster song. And so these Black mothers decide, through various means, that they need to organize to stop this because they understand - rightfully so - that the fight against lynching, against desegregation, voting rights, all comes down to an issue of dehumanization, and that that is what minstrelsy is. It is a mass dehumanization and caricature of Black life. And by 1970, most of these publishing houses were going under because of the incredible work of Black and white mothers who worked with them. There were a lot of Jewish American mothers who were concerned by this, but also people who were moved by the Civil Rights Movement, who said, I don't want my child performing this, and I don't want to perform this. This is not acceptable.</div>
        <div class="desc-cite">-NPR Article: This historian dug up the hidden history of 'amateur' blackface in America</div>
      `;

      function toggleDesc10(){
        const expanded = btn10.getAttribute('aria-expanded') === 'true';
        btn10.setAttribute('aria-expanded', String(!expanded));
        desc10.classList.toggle('collapsed');
        if(desc10.classList.contains('collapsed')){
          desc10.style.display = 'none';
        } else {
          desc10.style.display = '';
        }
        try{ resetIdleTimer(); }catch(_){ }
      }
      btn10.addEventListener('click', toggleDesc10);
      btn10.addEventListener('touchstart', (e)=>{ e.preventDefault(); toggleDesc10(); });
      btn10.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDesc10(); } });

    toggleWrap10.appendChild(iconBox10);
    toggleWrap10.appendChild(desc10);
      // lower the toggle for page 10 as well so icon sits at the same vertical placement as page 9
      toggleWrap10.classList.add('lowered-toggle');
      wrapper.appendChild(toggleWrap10);
    }

    // Add an icon-button which toggles a description on the tenth page (index 9)
    if(current === 9){
      const toggleWrapFact = document.createElement('div');
      // stacked layout: button above description so the description appears below when opened
      toggleWrapFact.className = 'page-toggle stacked';

      const btnFact = document.createElement('button');
      btnFact.className = 'icon-button';
      btnFact.type = 'button';
      btnFact.setAttribute('aria-expanded', 'false');
      btnFact.setAttribute('aria-label', 'Show history fact');

      const iconFact = document.createElement('img');
      iconFact.src = IMAGE_FOLDER + 'fact 1.png';
      iconFact.alt = 'Fact 1 image';
      btnFact.appendChild(iconFact);

      // icon box + label
      const iconBoxFact = document.createElement('div');
      iconBoxFact.className = 'icon-box';
      iconBoxFact.appendChild(btnFact);
      const labelFact = document.createElement('div');
      labelFact.className = 'icon-label';
      labelFact.textContent = 'History Fact';
      iconBoxFact.appendChild(labelFact);

      const descFact = document.createElement('div');
      descFact.className = 'page-desc collapsed';
      descFact.classList.add('no-bg');
      descFact.innerHTML = `
        <div class="desc-main">“Historians right now are in somewhat of a culture war in that it is our patriotic duty as American citizens and as patriots to help make sure that the American public has access to our history in all of its complexity. And the truth is that you can't understand the victories and the triumphs without understanding how far Americans had to push. And I think that's especially true of blackface. When we didn't adequately understand how long blackface was a mainstay in American culture. Because many historians believe that it had died out by 1900, when in fact it only accelerated and increased up through the 1970s. And so if you just say, "Oh, it just died out. It was no longer in fashion," then what you're losing is the incredible, dangerous, and brave work of thousands of Black and white mothers across the United States in the 1950s and the 1960s, of students who stood up during Jim Crow America and said, "This is not OK. We are humans. We deserve dignity. And we want you to understand our history." …”</div>
        <div class="desc-cite">-NPR Article: This historian dug up the hidden history of 'amateur' blackface in America</div>
      `;

      function toggleDescFact(){
        const expanded = btnFact.getAttribute('aria-expanded') === 'true';
        btnFact.setAttribute('aria-expanded', String(!expanded));
        descFact.classList.toggle('collapsed');
        if(descFact.classList.contains('collapsed')){ descFact.style.display = 'none'; } else { descFact.style.display = ''; }
        try{ resetIdleTimer(); }catch(_){ }
      }
      btnFact.addEventListener('click', toggleDescFact);
      btnFact.addEventListener('touchstart', (e)=>{ e.preventDefault(); toggleDescFact(); });
      btnFact.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDescFact(); } });

      toggleWrapFact.appendChild(iconBoxFact);
      toggleWrapFact.appendChild(descFact);
      // ensure it uses the lowered positioning so it aligns with page 6 area
      toggleWrapFact.classList.add('lowered-toggle');
      wrapper.appendChild(toggleWrapFact);
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
