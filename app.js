/* Pop Archive is deliberately build-free. Classic scripts also work over file://. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${({search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',moon:'<path d="M20.6 14a9 9 0 0 1-10.6-10.6A9 9 0 1 0 20.6 14Z"/>',check:'<path d="m5 12 4 4L19 6"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"/>'})[name] || ''}</svg>`;
  const safeURL = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  const safeAsset = value => typeof value === 'string' && /^assets\/[A-Za-z0-9_./-]+$/.test(value) && !value.includes('..') ? value : '';
  const catalog = Array.isArray(window.POP_CATALOG) ? window.POP_CATALOG : [];
  const personal = Array.isArray(window.POP_COLLECTION) ? window.POP_COLLECTION : [];
  const people = window.POP_PEOPLE && typeof window.POP_PEOPLE === 'object' ? window.POP_PEOPLE : { owner:{id:'pau',name:'Pau',image:'assets/owner/pau.webp'}, contributors:[] };
  const translations = window.POP_I18N || { en:{} };
  const catalogMap = new Map(catalog.map(item => [item.id, item]));
  const items = personal.filter(item => catalogMap.has(item.catalogId)).map(record => ({...catalogMap.get(record.catalogId), ...record}));
  const palettes = { 'Star Wars':'#e4eddc',Marvel:'#f5dfd5',Disney:'#e7ddf7','Pokémon':'#f9edb9','Harry Potter':'#e9dcca','Demon Slayer':'#d9ebe6','Dragon Ball':'#f9dfbe','One Piece':'#dceaf5',Naruto:'#f5e3cc',DC:'#dce8ef',Fortnite:'#e5e0f8','My Hero Academia':'#f8ddd1','Jujutsu Kaisen':'#e2dcf6','Marvel vs. Capcom':'#d9ebf6','Sonic the Hedgehog':'#d9e8fb','El Chapulín Colorado':'#f7d9d4','Chainsaw Man':'#eadfda',"JoJo's Bizarre Adventure":'#e3def5' };
  const color = item => palettes[item.franchise] || '#e2eae4';
  const universeNames = [...new Set(items.map(item => item.franchise))];
  const state = { view:'collection',query:'',franchise:'',series:'',acquisition:'',contributor:'',sort:'shelf' };
  const owned = items.filter(item => item.status === 'owned');
  const wanted = items.filter(item => item.status === 'wishlist');
  const personMap = new Map((people.contributors || []).map(person => [person.id, person]));
  let spotlightIndex = 0;
  let lastDetailTrigger = null;
  let language = 'en';
  try { language = localStorage.getItem('funko-pau-language') === 'es' ? 'es' : 'en'; } catch { /* Storage is optional when opening local files. */ }
  const text = () => translations[language] || translations.en || {};
  const tr = (key, fallback = '') => text()[key] ?? translations.en?.[key] ?? fallback;
  const interpolate = (value, replacements = {}) => Object.entries(replacements).reduce((result,[key,replacement])=>result.replaceAll(`{${key}}`,replacement),value);
  const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  const contributorColors = ['#e4eddc','#f5dfd5','#e7ddf7','#dceaf5','#f9edb9'];
  const formatDate = date => { if (!date) return tr('notRecorded','Not recorded'); const value = new Date(`${date}T12:00:00`); return Number.isNaN(value.valueOf()) ? tr('notRecorded','Not recorded') : value.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB',{day:'numeric',month:'short',year:'numeric'}); };
  const localizeAcquisition = value => ({Bought:tr('bought','Bought'),Gifted:tr('gifted','Gifted'),Traded:tr('traded','Traded'),Other:language==='es'?'Otro':'Other'})[value] || value || tr('owned','Owned');
  const imageSources = item => {
    const alternate = safeAsset(item?.alternateImageUrl);
    const remote = safeURL(item?.imageUrl);
    return alternate
      ? { primary: alternate, fallback: remote }
      : { primary: remote, fallback: '' };
  };
  const productImage = (item, options = {}) => {
    const sources = imageSources(item);
    return `<img src="${escapeHTML(sources.primary)}" alt="${escapeHTML(item.name)} Funko figure" ${options.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="400" height="400" referrerpolicy="no-referrer" data-fallback="${escapeHTML(sources.fallback)}">`;
  };
  // Universe carousel artwork is decorative because the card itself owns the accessible name.
  const universeFigureImage = item => {
    const sources = imageSources(item);
    return `<img src="${escapeHTML(sources.primary)}" alt="" aria-hidden="true" loading="lazy" decoding="async" width="240" height="240" referrerpolicy="no-referrer" data-fallback="${escapeHTML(sources.fallback)}">`;
  };
  const personVisual = person => `<span class="person-visual" data-person-visual><span class="person-fallback" aria-hidden="true">${escapeHTML(initials(person?.name))}</span>${safeAsset(person?.image) ? `<img src="${escapeHTML(safeAsset(person.image))}" alt="${escapeHTML(person.name)}" decoding="async" data-person-image>` : ''}</span>`;
  // The owner spotlight deliberately uses the original Pop Archive image structure.
  // No wrapper sits between .featured-product and its image, so the original motion,
  // containment and transparent-background treatment remain untouched.
  const ownerSpotlightVisual = person => {
    const src = safeAsset(person?.image);
    return src
      ? `<img src="${escapeHTML(src)}" alt="${escapeHTML(person?.name || 'Pau')}" decoding="async" data-owner-image>`
      : `<span class="owner-spotlight-fallback" aria-hidden="true">${escapeHTML(initials(person?.name))}</span>`;
  };

  // A missing image gets an honest recoverable state, never fabricated art.
  // Local alternates can be preferred first, then safely fall back to the remote catalog art.
  function bindImageErrors(root = document) {
    $$('img:not([data-person-image]):not([data-owner-image])', root).forEach(img => {
      if (img.dataset.errorBound === 'true') return;
      img.dataset.errorBound = 'true';
      img.addEventListener('error', () => {
        const message = document.createElement('span'); message.className='image-error'; message.textContent=tr('photoUnavailable','Photo unavailable. Open details for the catalog source.');
        const fallback = img.dataset.fallback;
        if (fallback && fallback !== img.src && img.dataset.fallbackTried !== 'true') {
          img.dataset.fallbackTried = 'true';
          img.addEventListener('error', () => img.replaceWith(message), {once:true});
          img.src = fallback;
        } else img.replaceWith(message);
      }, {once:true});
    });
  }
  function bindPersonImages(root = document) {
    $$('[data-person-visual]', root).forEach(visual => {
      const img = $('[data-person-image]', visual);
      if (!img || img.dataset.personBound === 'true') return;
      img.dataset.personBound = 'true';
      const loaded = () => { visual.classList.add('has-image'); img.classList.remove('is-missing'); };
      const failed = () => { visual.classList.remove('has-image'); img.classList.add('is-missing'); };
      img.addEventListener('load', loaded, {once:true});
      img.addEventListener('error', failed, {once:true});
      if (img.complete) { if (img.naturalWidth > 0) loaded(); else failed(); }
    });
  }
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('#theme').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
    $('#theme').setAttribute('aria-label', theme === 'dark' ? tr('themeLight','Switch to light theme') : tr('themeDark','Switch to dark theme'));
    try { localStorage.setItem('pop-archive-theme', theme); } catch { /* Storage is optional when opening local files. */ }
  }
  let initialTheme = 'light';
  try { initialTheme = localStorage.getItem('pop-archive-theme') || 'light'; } catch { /* Fall back to the designed light palette. */ }
  setTheme(initialTheme === 'dark' ? 'dark' : 'light');
  $('#theme').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#search-icon').innerHTML = icon('search');

  const productSpotlights = universeNames.map(name => owned.find(item => item.franchise === name)).filter(Boolean).slice(0,3).map(item => ({kind:'product',item}));
  const spotlights = [{kind:'owner',person:people.owner || {name:'Pau',image:'assets/owner/pau.webp'}}, ...productSpotlights];
  function renderSpotlight() {
    const spotlight = spotlights[spotlightIndex];
    if (!spotlight) { $('.hero-stage').hidden=true; return; }
    const button = $('#featured-product');
    if (spotlight.kind === 'owner') {
      button.innerHTML=ownerSpotlightVisual(spotlight.person);button.dataset.kind='owner';delete button.dataset.product;
      button.setAttribute('aria-label',`${spotlight.person.name} — ${tr('ownerRole','Owner / Curator')}`);
      $('#featured-name').textContent=spotlight.person.name;$('#featured-franchise').textContent=tr('ownerRole','Owner / Curator');
      const ownerImage = $('[data-owner-image]', button);
      if (ownerImage) {
        ownerImage.addEventListener('error', () => {
          ownerImage.replaceWith(Object.assign(document.createElement('span'), {
            className:'owner-spotlight-fallback',
            textContent:initials(spotlight.person?.name)
          }));
        }, {once:true});
      }
    } else {
      button.innerHTML=productImage(spotlight.item,{eager:true});button.dataset.kind='product';button.dataset.product=spotlight.item.id;
      button.setAttribute('aria-label',interpolate(tr('openDetails','View {name} details'),{name:spotlight.item.name}));
      $('#featured-name').textContent=spotlight.item.name;$('#featured-franchise').textContent=`${spotlight.item.franchise} · ${spotlight.item.line || 'Pop!'}`;
    }
    $('#spotlight-controls').innerHTML=spotlights.map((entry,index)=>`<button aria-label="${escapeHTML(entry.kind==='owner'?entry.person.name:entry.item.name)}" aria-pressed="${index===spotlightIndex}" data-spotlight="${index}"></button>`).join('');
    bindImageErrors($('.hero-stage'));
  }
  $('#featured-product').addEventListener('click',event=>{const button=event.currentTarget;if(button.dataset.kind==='product'&&button.dataset.product)showDetail(button.dataset.product,button);});
  $('#spotlight-controls').addEventListener('click',event=>{const target=event.target.closest('[data-spotlight]');if(target){spotlightIndex=Number(target.dataset.spotlight);renderSpotlight();$(`[data-spotlight="${spotlightIndex}"]`).focus();}});

  function resetFilters(){state.query='';state.franchise='';state.series='';state.acquisition='';state.contributor='';$('#search').value='';$('#acquisition').value='';}
  function syncView() {
    const hash = location.hash.slice(1);
    if (!['collection','wishlist','universes','contributors'].includes(hash)) return;
    const changed = state.view!==hash;
    state.view=hash;
    if(changed)resetFilters();
    render();
  }
  window.addEventListener('hashchange',syncView);
  function baseItems(){return items.filter(item=>state.view==='universes'||item.status===(state.view==='wishlist'?'wishlist':'owned'));}
  function visibleItems(){
    const query=state.query.trim().toLocaleLowerCase(language === 'es' ? 'es' : 'en');
    return baseItems().filter(item=>(!state.franchise||item.franchise===state.franchise)&&(!state.series||item.series===state.series)&&(!state.acquisition||item.acquisition===state.acquisition)&&(!state.contributor||item.giftedBy===state.contributor)&&(!query||[item.name,item.franchise,item.series,item.number,item.variant,item.line].join(' ').toLocaleLowerCase().includes(query))).sort((a,b)=>{
      if(state.sort==='az')return a.name.localeCompare(b.name,language);
      if(state.sort==='franchise')return a.franchise.localeCompare(b.franchise,language)||a.name.localeCompare(b.name,language);
      if(state.sort==='number')return (Number(a.number)||Number.MAX_SAFE_INTEGER)-(Number(b.number)||Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name,language);
      if(state.sort==='priority')return (b.priority||0)-(a.priority||0)||a.name.localeCompare(b.name,language);
      return (a.shelfOrder||Number.MAX_SAFE_INTEGER)-(b.shelfOrder||Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name,language);
    });
  }
  function renderChips(){
    const franchises=[...new Set(baseItems().map(item=>item.franchise))];
    $('#franchise-chips').innerHTML=['',...franchises].map(name=>`<button class="chip" data-franchise="${escapeHTML(name)}" aria-pressed="${state.franchise===name}">${name?'<span aria-hidden="true">✦</span>':''}${escapeHTML(name||tr('allUniverses','All universes'))}</button>`).join('');
    const series=[...new Set(baseItems().filter(item=>!state.franchise||item.franchise===state.franchise).map(item=>item.series))].sort((a,b)=>a.localeCompare(b,language));
    if(!series.includes(state.series))state.series='';
    $('#series').innerHTML=`<option value="">${escapeHTML(tr('allSeries','All series'))}</option>`+series.map(name=>`<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join('');
    $('#series').value=state.series;
    $('#acquisition').innerHTML=`<option value="">${escapeHTML(tr('anyWay','Any way'))}</option><option value="Bought">${escapeHTML(tr('bought','Bought'))}</option><option value="Gifted">${escapeHTML(tr('gifted','Gifted'))}</option><option value="Traded">${escapeHTML(tr('traded','Traded'))}</option><option value="Other">${language==='es'?'Otro':'Other'}</option>`;
    $('#acquisition').value=state.acquisition;
    const isWanted=state.view==='wishlist';
    $('#sort').innerHTML=`<option value="shelf">${escapeHTML(tr('sortShelf','Shelf order'))}</option><option value="az">${escapeHTML(tr('sortName','Name: A–Z'))}</option><option value="number">${escapeHTML(tr('sortNumber','Box number'))}</option><option value="franchise">${escapeHTML(tr('sortUniverse','Universe'))}</option>${isWanted?`<option value="priority">${escapeHTML(tr('sortPriority','Wishlist priority'))}</option>`:''}`;
    if(![...$('#sort').options].some(option=>option.value===state.sort))state.sort=isWanted?'priority':'shelf';
    $('#sort').value=state.sort;
  }
  function card(item,index){
    const isWanted=item.status==='wishlist';
    // V5.2: artwork badges describe the edition only; ownership stays in the bottom row.
    const variant=typeof item.variant==='string'?item.variant.trim():'';
    const badge=variant&&variant.toLowerCase()!=='standard'?variant:'';
    const status=isWanted?(item.priority===3?tr('topPick','Top pick'):tr('wishlist','Wishlist')):(item.acquisition?localizeAcquisition(item.acquisition):tr('owned','Owned'));
    return `<article class="product-card" style="--card-color:${color(item)};--i:${Math.min(index,11)}"><button class="card-open" data-product="${escapeHTML(item.id)}" aria-label="${escapeHTML(interpolate(tr('openDetails','View {name} details'),{name:item.name}))}"><div class="card-art">${badge?`<span class="card-badge">${escapeHTML(badge)}</span>`:''}${productImage(item,{eager:index<4})}<span class="card-reveal" aria-hidden="true">↗</span></div><div class="card-details"><div class="card-franchise">${escapeHTML(item.franchise)}</div><h3>${escapeHTML(item.name)}</h3><p class="card-series">${escapeHTML(item.series)}</p><div class="card-bottom"><span class="card-code">${item.number?`Pop! ${escapeHTML(item.number)}`:escapeHTML(item.line||'Pop!')}</span><span class="card-status">${icon(isWanted?'heart':item.acquisition==='Gifted'?'gift':'check')}${escapeHTML(status)}</span></div></div></button></article>`;
  }
  function renderUniverses(list){
    $('#universe-grid').innerHTML=universeNames.map((name,index)=>{
      const figures=list.filter(item=>item.franchise===name);if(!figures.length)return '';
      const allFigures=items.filter(item=>item.franchise===name);
      const figure=allFigures.find(item=>item.status==='owned')||allFigures[0];
      const count=allFigures.filter(item=>item.status==='owned').length;
      const wish=allFigures.filter(item=>item.status==='wishlist').length;
      const needsStaticRail=allFigures.length<=2;
      // V5.7: figure sizing stays fixed for every universe. One-item and two-item universes
      // keep the real figures visible exactly once so the opening composition never shows
      // duplicate artwork. Three or more figures keep the looping carousel presentation.
      const carouselFigures=needsStaticRail?allFigures:allFigures;
      const carouselGroup=carouselFigures.map(item=>`<span class="universe-figure">${universeFigureImage(item)}</span>`).join('');
      const duration=Math.max(14,carouselFigures.length*2.7);
      const delay=-(index%7)*1.15;
      const trackClass=`universe-carousel-track${needsStaticRail?' universe-carousel-track--static':''}`;
      const groupClass=`universe-carousel-group${needsStaticRail?' universe-carousel-group--static':''}`;
      const loopGroup=needsStaticRail?'':`<span class="universe-carousel-group">${carouselGroup}</span>`;
      // Universe cards keep navigation behavior while presenting the full world
      // as a title, continuously looping figure rail where appropriate, and a dedicated
      // ownership strip. Sparse universes intentionally render once without visible duplicates.
      return `<button class="universe-card${needsStaticRail?' universe-card--static':''}" style="--card-color:${color(figure)};--carousel-duration:${duration}s;--carousel-delay:${delay}s" data-universe="${escapeHTML(name)}" aria-label="${escapeHTML(`${name} — ${count} ${tr('owned','Owned')}, ${wish} ${tr('wishlist','Wishlist')}`)}"><span class="universe-card-main" aria-hidden="true"><span class="universe-card-title">${escapeHTML(name)}</span><span class="universe-carousel${needsStaticRail?' universe-carousel--static':''}"><span class="${trackClass}"><span class="${groupClass}">${carouselGroup}</span>${loopGroup}</span></span></span><span class="universe-stats" aria-hidden="true"><span class="universe-stat">${icon('check')}<strong>${count}</strong><span class="universe-stat-label">${escapeHTML(tr('owned','Owned'))}</span></span><span class="universe-stat">${icon('heart')}<strong>${wish}</strong><span class="universe-stat-label">${escapeHTML(tr('wishlist','Wishlist'))}</span></span></span></button>`;
    }).join('');bindImageErrors($('#universe-grid'));
  }
  function renderContributors(){
    const query=state.query.trim().toLocaleLowerCase(language === 'es' ? 'es' : 'en');
    // Rank the complete list before search so filtering never changes a person's rank.
    const ranked=(people.contributors||[]).map((person,index)=>({person,index,gifts:owned.filter(item=>item.giftedBy===person.id)})).sort((a,b)=>b.gifts.length-a.gifts.length||a.person.name.localeCompare(b.person.name,language)).map((entry,index)=>({...entry,rank:index+1})).filter(entry=>!query||entry.person.name.toLocaleLowerCase().includes(query));
    $('#result-count').textContent=`${ranked.length} ${ranked.length===1?tr('contributor','contributor'):tr('contributors','contributors')}`;
    const crown='<svg class="contributor-crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l5 4 4-7 4 7 5-4-2 12H5Z" fill="currentColor" stroke="none"/><circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="3" r="1.5" fill="currentColor" stroke="none"/><circle cx="21" cy="6" r="1.5" fill="currentColor" stroke="none"/></svg>';
    $('#contributor-grid').innerHTML=ranked.map(entry=>{
      const count=entry.gifts.length;
      const countText=`${count} ${count===1?tr('gift','gift'):tr('gifts','gifts')}`;
      const rankText=language==='es'?`Posición ${entry.rank}`:`Rank ${entry.rank}`;
      const actionText=count?`${tr('viewGifts','View gifted figures')} — ${entry.person.name}`:tr('noGifts','No linked gifts yet');
      return `<article class="contributor-card contributor-row" data-rank="${entry.rank}" data-edit-contributor="${escapeHTML(entry.person.id)}"><div class="contributor-rank" role="img" aria-label="${escapeHTML(rankText)}">${entry.rank<=3?crown:''}<span aria-hidden="true">${entry.rank}</span></div><div class="contributor-portrait">${personVisual(entry.person)}</div><div class="contributor-copy"><h3>${escapeHTML(entry.person.name)}</h3><p class="contributor-count" role="img" aria-label="${escapeHTML(countText)}">${icon('gift')}<span aria-hidden="true">${count}</span></p></div><button class="contributor-arrow" data-contributor="${escapeHTML(entry.person.id)}" aria-label="${escapeHTML(actionText)}" title="${escapeHTML(actionText)}"${count?'':' disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></article>`;
    }).join('');
    bindPersonImages($('#contributor-grid'));
  }
  function applyStaticText(){
    document.documentElement.lang=language;document.title='Funko Pau';
    $('meta[name="description"]').setAttribute('content',tr('metaDescription',"Pau's personal Funko collection."));
    $('#skip-link').textContent=tr('skip','Skip to collection');
    $('[data-nav="collection"]').textContent=tr('navCollection','Collection');$('[data-nav="wishlist"]').textContent=tr('navWishlist','Wishlist');$('[data-nav="universes"]').textContent=tr('navUniverses','Universes');$('[data-nav="contributors"]').textContent=tr('navContributors','Contributors');
    $('#language').textContent=language==='en'?'ES':'EN';$('#language').setAttribute('aria-label',tr('languageSwitch','Cambiar a español'));
    $('#hero-kicker').textContent=tr('heroKicker');$('#hero-title').innerHTML=tr('heroTitle');$('#hero-description').innerHTML=tr('heroDescription');$('#hero-explore').textContent=tr('heroExplore');$('#hero-gift').textContent=tr('heroGift');$('#spotlight-label').textContent=tr('spotlight');
    $('#hero-stats').innerHTML=`<span><strong>${owned.length}</strong> ${escapeHTML(tr('statShelf'))}</span><span><strong>${universeNames.length}</strong> ${escapeHTML(tr('statUniverses'))}</span><span><strong>${wanted.length}</strong> ${escapeHTML(tr('statWishlist'))}</span>`;
    $('#search').placeholder=state.view==='contributors'?tr('searchContributors','Find a contributor…'):tr('searchPlaceholder','Find a character, series…');$('#search-label').textContent=state.view==='contributors'?tr('searchContributors','Find a contributor…'):tr('searchLabel','Search the catalog');$('#series-label').textContent=tr('seriesLabel');$('#acquired-label').textContent=tr('acquiredLabel');
    $('#empty-title').textContent=state.view==='wishlist'?tr('emptyWishlistTitle'):tr('emptyTitle');$('#empty-copy').textContent=state.view==='wishlist'?tr('emptyWishlistCopy'):tr('emptyCopy');$('#clear-filters').textContent=tr('clearFilters');
    $('#gift-kicker').textContent=tr('giftBannerKicker');$('#gift-title').textContent=tr('giftBannerTitle');$('#gift-copy').textContent=tr('giftBannerCopy');$('#gift-action').textContent=tr('giftBannerAction');
    $('#footer-tagline').textContent=tr('footerTagline');$('#footer-legal').textContent=tr('footerLegal');
    $('#nav-owned').textContent=owned.length;$('#nav-wanted').textContent=wanted.length;
    setTheme(document.documentElement.dataset.theme || 'light');
  }
  function render(){
    const isWanted=state.view==='wishlist';const isUniverses=state.view==='universes';const isContributors=state.view==='contributors';
    $$('[data-view]').forEach(link=>{if(link.dataset.view===state.view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    applyStaticText();
    $('#browse-title').innerHTML=`${escapeHTML(isWanted?tr('wishlistTitle','The dream shelf'):isUniverses?tr('universesTitle','Pick your universe'):isContributors?tr('contributorsTitle','Contributor ranking'):tr('collectionTitle','Meet the collection'))}<span class="accent-dot">.</span>`;
    $('#section-kicker').textContent=isWanted?tr('wishlistKicker','NEXT ON THE SHELF'):isUniverses?tr('universesKicker','WORLDS WORTH COLLECTING'):isContributors?tr('contributorsKicker','THE PEOPLE BEHIND THE SHELF'):tr('collectionKicker','THE GOOD STUFF');
    $('#section-description').textContent=isWanted?tr('wishlistDescription'):isUniverses?tr('universesDescription'):isContributors?tr('contributorsDescription'):tr('collectionDescription');
    $('#gift-banner').hidden=isWanted;$('#acquisition-label').hidden=isWanted||isUniverses||isContributors;
    $('.hero').hidden=state.view!=='collection';
    $('.toolbar').hidden=isUniverses||isContributors;$('#franchise-chips').hidden=isUniverses||isContributors;
    $('#grid').hidden=isUniverses||isContributors;$('#universe-grid').hidden=!isUniverses;$('#contributor-grid').hidden=!isContributors;
    renderChips();
    if(isContributors){renderContributors();$('#active-filters').innerHTML='';$('#empty').hidden=true;document.dispatchEvent(new Event('pau:render'));return;}
    const list=visibleItems();
    $('#result-count').textContent=`${list.length} ${list.length===1?tr('figure','figure'):tr('figures','figures')}`;
    $('#active-filters').innerHTML=[['query',state.query],['franchise',state.franchise],['series',state.series],['acquisition',state.acquisition],['contributor',state.contributor?personMap.get(state.contributor)?.name||state.contributor:'']].filter(([,value])=>value).map(([key,value])=>`<button data-remove="${key}" aria-label="Remove ${escapeHTML(value)} filter">${escapeHTML(key==='acquisition'?localizeAcquisition(value):value)} <span aria-hidden="true">×</span></button>`).join('');
    $('#empty').hidden=list.length>0;
    if(isUniverses)renderUniverses(list);else{$('#grid').innerHTML=list.map(card).join('');bindImageErrors($('#grid'));}
    document.dispatchEvent(new Event('pau:render'));
  }

  $('#language').addEventListener('click',()=>{language=language==='en'?'es':'en';try{localStorage.setItem('funko-pau-language',language);}catch{/* Language preference is optional. */}renderSpotlight();render();});
  $('#franchise-chips').addEventListener('click',event=>{const target=event.target.closest('[data-franchise]');if(target){state.franchise=target.dataset.franchise;state.series='';state.contributor='';render();const buttons=$$('[data-franchise]');buttons.find(button=>button.dataset.franchise===state.franchise)?.focus({preventScroll:true});}});
  $('#series').addEventListener('change',event=>{state.series=event.target.value;render();});
  $('#acquisition').addEventListener('change',event=>{state.acquisition=event.target.value;render();});
  $('#sort').addEventListener('change',event=>{state.sort=event.target.value;render();});
  $('#search').addEventListener('input',event=>{state.query=event.target.value;render();});
  $('#clear-filters').addEventListener('click',()=>{resetFilters();render();$('#search').focus();});
  $('#active-filters').addEventListener('click',event=>{const target=event.target.closest('[data-remove]');if(target){state[target.dataset.remove]='';$('#search').value=state.query;$('#acquisition').value=state.acquisition;render();$('#search').focus();}});
  $('#universe-grid').addEventListener('click',event=>{const target=event.target.closest('[data-universe]');if(target){state.view='collection';resetFilters();state.franchise=target.dataset.universe;history.replaceState(null,'','#collection');render();}});
  $('#contributor-grid').addEventListener('click',event=>{const target=event.target.closest('[data-contributor]');if(target){state.view='collection';resetFilters();state.contributor=target.dataset.contributor;history.replaceState(null,'','#collection');render();}});
  $('#grid').addEventListener('click',event=>{const target=event.target.closest('[data-product]');if(target)showDetail(target.dataset.product,target);});
  function showDetail(id,trigger){
    const item=items.find(figure=>figure.id===id);if(!item)return;
    if(!$('#detail').open)lastDetailTrigger=trigger || document.activeElement;
    const isWanted=item.status==='wishlist';const similar=items.filter(figure=>figure.franchise===item.franchise&&figure.id!==id).slice(0,3);const giver=item.giftedBy?personMap.get(item.giftedBy):null;
    const metadata=[[tr('detailUniverse'),item.franchise],[tr('detailSeries'),item.series],[tr('detailLine'),item.line||'Pop!'],...(item.number?[[tr('detailBox'),item.number]]:[]),[tr('detailEdition'),item.variant||'Standard'],...(isWanted?[[tr('detailPriority','Priority'),item.priority===3?tr('mostWanted'):item.priority===2?tr('wouldLove','Would love'):tr('wishlist')]]:[...(item.acquiredAt?[[tr('detailAcquired'),formatDate(item.acquiredAt)]]:[]),...(item.acquisition?[[tr('detailHow'),localizeAcquisition(item.acquisition)]]:[]),...(giver?[[tr('detailGiftedBy'),giver.name]]:[])])];
    const note=[item.catalogNote,item.notes].filter(Boolean).join(' ');
    $('#detail-content').innerHTML=`<div class="detail-layout"><div class="detail-art" style="--card-color:${color(item)}">${productImage(item,{eager:true})}</div><div class="detail-copy"><div class="card-franchise">${escapeHTML(item.franchise)}</div><h2 id="detail-title">${escapeHTML(item.name)}</h2><p class="detail-subtitle">${escapeHTML(isWanted?tr('waitingShelf'):tr('partCollection'))}</p><dl>${metadata.map(([label,value])=>`<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>${note?`<p class="detail-note">${escapeHTML(note)}</p>`:''}${safeURL(item.productUrl)?`<a class="button button-dark" href="${escapeHTML(safeURL(item.productUrl))}" target="_blank" rel="noopener noreferrer">${escapeHTML(isWanted?tr('findPop'):tr('openProduct'))} <span aria-hidden="true">↗</span></a>`:''}${isWanted?`<p class="detail-footnote">${escapeHTML(tr('wishlistFootnote'))}</p>`:''}</div></div>${similar.length?`<section class="related"><h3>${escapeHTML(interpolate(tr('moreFrom','More from {name}'),{name:item.franchise}))}</h3><div class="related-list">${similar.map(figure=>`<button class="related-item" data-related="${escapeHTML(figure.id)}">${productImage(figure)}<span>${escapeHTML(figure.name)}</span></button>`).join('')}</div></section>`:''}`;
    bindImageErrors($('#detail-content'));
    document.dispatchEvent(new CustomEvent('pau:detail',{detail:{id}}));
    if(!$('#detail').open){$('#detail').showModal();document.body.classList.add('modal-open');}
    $('#detail').scrollTop=0;$('#close-detail').focus({preventScroll:true});
  }
  $('#detail-content').addEventListener('click',event=>{const target=event.target.closest('[data-related]');if(target)showDetail(target.dataset.related);});
  $('#close-detail').addEventListener('click',()=>$('#detail').close());
  $('#detail').addEventListener('click',event=>{if(event.target===$('#detail')){const bounds=$('#detail').getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)$('#detail').close();}});
  $('#detail').addEventListener('close',()=>{document.body.classList.remove('modal-open');if(lastDetailTrigger?.isConnected)lastDetailTrigger.focus({preventScroll:true});});
  document.addEventListener('keydown',event=>{
    const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||document.activeElement.isContentEditable;
    if(!document.querySelector('dialog[open]')&&((event.key==='/'&&!typing)||((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'))){event.preventDefault();$('#search').focus();}
  });
  // Progressive agent access uses the same search state and rendering as the visible UI.
  // Unsupported browsers simply use the regular controls.
  if (document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    try {
      Promise.resolve(document.modelContext.registerTool({
        name:'search_collection',title:'Search the Funko collection',
        description:'Show matching figures in the collection or wishlist without changing ownership data.',
        inputSchema:{type:'object',properties:{query:{type:'string'},view:{type:'string',enum:['collection','wishlist']}},required:['query'],additionalProperties:false},
        annotations:{readOnlyHint:false,untrustedContentHint:false},
        execute(input) {
          if (!input || typeof input.query !== 'string' || (input.view && !['collection','wishlist'].includes(input.view))) throw new Error('Provide a search query and a valid collection or wishlist view.');
          resetFilters();state.view=input.view||'collection';state.query=input.query;$('#search').value=state.query;
          history.replaceState(null,'','#'+state.view);render();
          return {view:state.view,figures:visibleItems().map(item=>({id:item.id,name:item.name,franchise:item.franchise,status:item.status}))};
        }
      },{signal:lifecycle.signal})).catch(()=>{});
      window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
    } catch { /* Optional API failure never affects the collection. */ }
  }
  // V5: the editor supplies local preview data through this single render bridge.
  // Published globals remain untouched; leaving edit mode restores their snapshot.
  window.PauView = {
    replaceData(data) {
      personal.splice(0, personal.length, ...data.collection.map(record => ({...record})));
      people.contributors = data.people.contributors.map(person => ({...person}));
      items.splice(0, items.length, ...personal.filter(record => catalogMap.has(record.catalogId)).map(record => ({...catalogMap.get(record.catalogId), ...record})));
      owned.splice(0, owned.length, ...items.filter(item => item.status === 'owned'));
      wanted.splice(0, wanted.length, ...items.filter(item => item.status === 'wishlist'));
      personMap.clear(); people.contributors.forEach(person => personMap.set(person.id, person));
      render();
    }
  };
  renderSpotlight();render();syncView();
})();
