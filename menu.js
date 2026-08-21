// ===================================================================
// menu.js — Application Logic (with bilingual support & admin sync)
// ===================================================================

const MENU_ITEMS_DEFAULT = (function () {
    const sources = [
        typeof BREAKFAST_ITEMS    !== 'undefined' ? BREAKFAST_ITEMS    : [],
        typeof HOT_DRINKS_ITEMS   !== 'undefined' ? HOT_DRINKS_ITEMS   : [],
        typeof LUNCH_DINNER_ITEMS !== 'undefined' ? LUNCH_DINNER_ITEMS : [],
        typeof SNACK_ITEMS        !== 'undefined' ? SNACK_ITEMS        : [],
        typeof SOFT_DRINKS_ITEMS  !== 'undefined' ? SOFT_DRINKS_ITEMS  : [],
        typeof TRADITIONAL_ITEMS  !== 'undefined' ? TRADITIONAL_ITEMS  : [],
        typeof BEER_ITEMS         !== 'undefined' ? BEER_ITEMS         : [],
    ];
    return [].concat(...sources);
})();

// Load menu from API (primary) with JS file fallback for offline static hosting
function getMenuItemsFromDefaults() {
    return MENU_ITEMS_DEFAULT.map(i => ({ ...i, available: true }));
}

function mapApiItem(i, catMap) {
    const category = i.category_key || i.category || '';
    const cat = CATEGORIES.find(item => item.key === category) || catMap[category];
    const apiName = String(i.name_en || i.nameEn || i.name || '').trim().toLowerCase();
    const localItem = MENU_ITEMS_DEFAULT.find(item => (
        item.id === i.id
        || (item.category === category && item.nameEn.trim().toLowerCase() === apiName)
    ));
    const availability = i.is_available !== undefined ? i.is_available : i.available;
    const isVisible = availability === undefined || availability === null
        ? true
        : availability === true || availability === 1 || availability === '1' || availability === 'true';
    return {
        id: i.id,
        category,
        catAm: localItem?.catAm || cat?.am || cat?.name_am || category,
        catEn: localItem?.catEn || cat?.en || cat?.name_en || category,
        nameAm: i.name_am || i.nameAm || localItem?.nameAm || i.name || '',
        nameEn: i.name_en || i.nameEn || localItem?.nameEn || i.name || '',
        descAm: i.desc_am || i.description_am || i.descAm || i.descriptionAm || localItem?.descAm || i.description || '',
        descEn: i.desc_en || i.description_en || i.descEn || i.descriptionEn || localItem?.descEn || i.description || '',
        price: parseFloat(i.price),
        img: i.img || i.image_url || '',
        tagAm: i.tag_am || localItem?.tagAm || '',
        tagEn: i.tag_en || localItem?.tagEn || '',
        available: isVisible,
    };
}

let MENU_ITEMS = getMenuItemsFromDefaults();
let API_CATEGORIES = null;
const CATEGORY_ORDER = ['ALL', 'BREAKFAST', 'HOT_DRINKS', 'LUNCH_DINNER', 'SNACK', 'SOFT_DRINKS', 'TRADITIONAL', 'BEER'];

function categoryRank(key) {
    const index = CATEGORY_ORDER.indexOf(key);
    return index === -1 ? CATEGORY_ORDER.length : index;
}

function sortMenuItems(items) {
    return items.slice().sort((left, right) => {
        const categoryDifference = categoryRank(left.category) - categoryRank(right.category);
        return categoryDifference || Number(left.id || 0) - Number(right.id || 0);
    });
}

async function loadMenuFromApi() {
    try {
        const menuRes = await fetch('/api/menu');
        const catRes = await fetch('/api/categories').catch(() => null);
        if (catRes?.ok) {
            const cats = await catRes.json();
            if (Array.isArray(cats) && cats.length) {
                API_CATEGORIES = cats;
                applyApiCategories(cats);
            }
        }
        if (menuRes.ok) {
            const data = await menuRes.json();
            if (Array.isArray(data) && data.length) {
                const catMap = Object.fromEntries((API_CATEGORIES || CATEGORIES).map(c => [c.key, c]));
                MENU_ITEMS = sortMenuItems(data.map(i => mapApiItem(i, catMap)));
                return true;
            }
        }
    } catch (e) {
        console.warn('Could not fetch live menu from API, using local data files', e);
    }
    MENU_ITEMS = getMenuItemsFromDefaults();
    return false;
}

function applyApiCategories(cats) {
    const localCategories = CATEGORIES.slice();
    const allCategory = localCategories.find(category => category.key === 'ALL');
    CATEGORIES.length = 0;
    if (allCategory) CATEGORIES.push(allCategory);
    cats.forEach(c => {
        const localCategory = localCategories.find(category => category.key === c.key);
        CATEGORIES.push({
            key: c.key,
            am: localCategory?.am || c.name_am,
            en: localCategory?.en || c.name_en,
            icon: localCategory?.icon || c.icon,
            hero_img: c.hero_img || localCategory?.hero_img || '',
            desc_am: localCategory?.desc_am || c.description_am || c.desc_am || '',
            desc_en: localCategory?.desc_en || c.description_en || c.desc_en || '',
        });
    });
    CATEGORIES.sort((left, right) => categoryRank(left.key) - categoryRank(right.key));
}

function getCatLabel(key, lang) {
    const found = (API_CATEGORIES || CATEGORIES).find(c => c.key === key);
    if (found) return lang === 'am' ? (found.name_am || found.am) : (found.name_en || found.en);
    const fallback = CATEGORIES.find(c => c.key === key);
    return fallback ? (lang === 'am' ? fallback.am : fallback.en) : key;
}

// ---- i18n ----
const I18N = {
    am: {
        search_ph: 'በአማርኛ ይፈልጉ...',
        all_menu: 'ሁሉም ዝርዝር', price: 'ዋጋ',
        tagline: 'ኑ ለራሳችን ዋጋ እንስጥ!!',
        banner_title: 'የምግብና መጠጥ ዝርዝር',
        banner_sub: 'ተወዳጅ የምግብና መጠጥ አማራጮችዎን ይፈልጉ',
        show_all: 'ሁሉንም አሳይ', no_results: 'ምንም ውጤት አልተገኘም',
        grid: 'ካርድ', list: 'ዝርዝር',
        unavail: 'አይገኝም',
        brand_title: 'የምግብና መጠጥ ዝርዝር',
        brand_badge: 'ዲጂታል',
        brand_slogan: 'ኑ ለራሳችን ዋጋ እንስጥ!!',
        payment: 'ክፍያ',
        admin: 'አስተዳዳሪ',
        payment_info: 'የክፍያ መረጃ',
        payment_subtitle: 'የክፍያ ዝርዝር መረጃን ይቅዱ ወይም ይደውሉ',
        close: 'ዝጋ',
        account_name: 'የመለያ ስም:',
        account_number: 'የሂሳብ ቁጥር:',
        mobile_number: 'የሞባይል ቁጥር:',
        copy: 'ቅዳ',
        created_by: 'የተፈጥሮ በ: solomie addisu',
        contact: 'አድራሻ: +251 908 071 504',
        digital_menu: 'የምግብና መጠጥ ዝርዝር ዲጂታል ሜኑ',
        digital_sub: 'ዲጂታል ሜኑ እና ዋጋ ማሳያ',
    },
    en: {
        search_ph: 'Search by name or category (e.g. Kitfo, Burger, Tea)...',
        all_menu: 'All Menu', price: 'Price',
        tagline: 'Come, Let\'s Value Ourselves!!',
        banner_title: 'Full Food & Drink Menu',
        banner_sub: 'Search for your favorite food and drink items',
        show_all: 'Show All', no_results: 'No results found',
        grid: 'Cards', list: 'List',
        unavail: 'Unavailable',
        brand_title: 'Food & Drink Menu',
        brand_badge: 'DIGITAL',
        brand_slogan: 'Come, Let\'s Value Ourselves!!',
        payment: 'Payment',
        admin: 'Admin',
        payment_info: 'Payment Information',
        payment_subtitle: 'Copy or call the payment details',
        close: 'Close',
        account_name: 'Account Name:',
        account_number: 'Account Number:',
        mobile_number: 'Mobile Number:',
        copy: 'Copy',
        created_by: 'Created by: solomie addisu',
        contact: 'Contact: +251 908 071 504',
        digital_menu: 'Digital Food & Drink Menu',
        digital_sub: 'Digital Menu & Price Showcase',
    }
};

let currentLang = localStorage.getItem('nu_lang') || 'am';

function t(key) { return (I18N[currentLang] || I18N.am)[key] || key; }

function applyI18n() {
    document.documentElement.lang = currentLang === 'am' ? 'am' : 'en';
    const si = document.getElementById('searchInput');
    if (si) si.placeholder = t('search_ph');
    const lb = document.getElementById('langBtnLabel');
    if (lb) lb.textContent = currentLang === 'am' ? 'EN' : 'አማ';
    const gb = document.getElementById('viewBtnGrid')?.querySelector('span');
    const cb = document.getElementById('viewBtnCompact')?.querySelector('span');
    if (gb) gb.textContent = t('grid');
    if (cb) cb.textContent = t('list');
    const bannerTagline = document.getElementById('bannerTagline');
    if (bannerTagline) bannerTagline.textContent = t('tagline');
    const bannerTitle = document.getElementById('bannerTitle');
    if (bannerTitle && currentCategory === 'ALL') bannerTitle.textContent = t('banner_title');
    const bannerSubtitle = document.getElementById('bannerSubtitle');
    if (bannerSubtitle && currentCategory === 'ALL') bannerSubtitle.textContent = t('banner_sub');
    const activeFilter = document.getElementById('activeFilterName');
    if (activeFilter && currentCategory === 'ALL') activeFilter.textContent = t('all_menu');
    document.querySelectorAll('[data-i18n="show_all"]').forEach(el => el.textContent = t('show_all'));
    const nr = document.querySelector('#emptyResults h3');
    if (nr) nr.textContent = t('no_results');

    const brandMainTitle = document.getElementById('brandMainTitle');
    if (brandMainTitle) brandMainTitle.textContent = t('brand_title');
    const brandBadge = document.getElementById('brandBadge');
    if (brandBadge) brandBadge.textContent = t('brand_badge');
    const brandSlogan = document.getElementById('brandSlogan');
    if (brandSlogan) brandSlogan.innerHTML = '<i class="fa-solid fa-gem text-[9px] text-amber-500"></i> ' + t('brand_slogan');
    const paymentBtnText = document.getElementById('paymentBtnText');
    if (paymentBtnText) paymentBtnText.textContent = t('payment');
    const adminBtnText = document.getElementById('adminBtnText');
    if (adminBtnText) adminBtnText.textContent = t('admin');

    const footerMainTitle = document.getElementById('footerMainTitle');
    if (footerMainTitle) footerMainTitle.textContent = t('digital_menu');
    const footerSubTitle = document.getElementById('footerSubTitle');
    if (footerSubTitle) footerSubTitle.textContent = t('digital_sub');
    const footerBy = document.getElementById('footerBy');
    if (footerBy) footerBy.textContent = t('created_by');
    const footerContact = document.getElementById('footerContact');
    if (footerContact) footerContact.textContent = t('contact');

    const paymentTitle = document.getElementById('paymentTitle');
    if (paymentTitle) paymentTitle.textContent = t('payment_info');
    const paymentSubtitle = document.getElementById('paymentSubtitle');
    if (paymentSubtitle) paymentSubtitle.textContent = t('payment_subtitle');
    const paymentCloseBtn = document.getElementById('paymentCloseBtn');
    if (paymentCloseBtn) paymentCloseBtn.textContent = t('close');

    const emptyText = document.querySelector('#emptyResults p');
    if (emptyText) emptyText.textContent = currentLang === 'en'
        ? 'Please search for another word or click Show All.'
        : 'እባክዎ ሌላ ቃል ይፈልጉ ወይም ሁሉንም አሳይ የሚለውን ይጫኑ።';
}

function toggleLanguage() {
    currentLang = currentLang === 'am' ? 'en' : 'am';
    localStorage.setItem('nu_lang', currentLang);
    applyI18n();
    renderCategoryNavPills();
    renderMenuItems();
    updateBanner(currentCategory);
    const modal = document.getElementById('paymentModal');
    if (modal && !modal.classList.contains('hidden')) {
        renderPaymentAccounts();
    }
}

// ---- Category config ----
const CATEGORIES = [
    { key: "ALL",          am: "ሁሉም",        en: "All",             icon: "fa-layer-group",     hero_img: "/menu-images/ethiopia.jpg", desc_am: "ሁሉንም ምግቦችና መጠጦች አሳይ", desc_en: "Browse all food and drinks" },
    { key: "BREAKFAST",    am: "የቁርስ ምግብ",   en: "Breakfast",       icon: "fa-egg",             hero_img: "/menu-images/4-nu-special-chechebsa.jpg", desc_am: "ጤናማ እና ሙሉ የቁርስ ምግቦች", desc_en: "Healthy and hearty breakfast dishes" },
    { key: "HOT_DRINKS",   am: "ትኩስ መጠጥ",   en: "Hot Drinks",      icon: "fa-mug-hot",         hero_img: "/menu-images/1-macchiato.jpg", desc_am: "ቡና፣ ሻይ እና ትኩስ መጠጦች", desc_en: "Coffee, tea and warm refreshments" },
    { key: "LUNCH_DINNER", am: "ምሳና ራት",     en: "Lunch & Dinner",  icon: "fa-drumstick-bite",  hero_img: "/menu-images/2-kitfo.jpg", desc_am: "ሙሉ እና ቀላል የምሳና ራት ምግቦች", desc_en: "Full meals and dinner favorites" },
    { key: "SNACK",        am: "መክሰስና ፒዛ",   en: "Snacks & Pizza",  icon: "fa-pizza-slice",     hero_img: "/menu-images/1-nu-pizza.jpg", desc_am: "ፒዛ፣ በርገር እና ቀላል ምግቦች", desc_en: "Pizza, burgers and quick bites" },
    { key: "BEER",         am: "የቢራ መጠጥ",   en: "Beer",            icon: "fa-beer-mug-empty",  hero_img: "/menu-images/habesha.jpg", desc_am: "ቀዝቃዛ ቢራ እና ሙቀት አልኮል መጠጦች", desc_en: "Cold beer and refreshing pours" },
    { key: "TRADITIONAL",  am: "ባህላዊ መጠጥ",  en: "Traditional",     icon: "fa-wine-glass",      hero_img: "/menu-images/tej betermus.jpg", desc_am: "ባህላዊ መጠጦች እና ጠጅ", desc_en: "Traditional drinks and locally inspired favorites" },
    { key: "SOFT_DRINKS",  am: "ለስላሳና ውሃ",  en: "Soft Drinks",     icon: "fa-bottle-water",    hero_img: "/menu-images/1-water.jpg", desc_am: "ለስላሳ መጠጦች፣ ጭማቂ እና ውሃ", desc_en: "Fresh drinks, juices and water" },
];

let currentCategory = "ALL";
let viewMode        = "compact";

// ---- Init ----
window.onload = async function () {
    applyI18n();
    await loadMenuFromApi();
    renderCategoryNavPills();
    updateBanner(currentCategory);
    setViewMode('compact');
    renderMenuItems();
    const si = document.getElementById('searchInput');
    if (si) {
        si.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); renderMenuItems(); }
        });
    }
    // Refresh menu every 60s so public page stays in sync with admin changes
    setInterval(async () => {
        const changed = await loadMenuFromApi();
        if (changed) {
            renderCategoryNavPills();
            updateBanner(currentCategory);
            renderMenuItems();
        }
    }, 60000);
};

// ---- Category Nav ----
function renderCategoryNavPills() {
    const container = document.getElementById("categoryNavPills");
    if (!container) return;
    container.innerHTML = CATEGORIES.map(cat => {
        const isActive    = cat.key === currentCategory;
        const label       = currentLang === 'en' ? cat.en : cat.am;
        const activeClass = isActive
            ? "bg-gradient-to-r from-amber-500 to-terracotta-500 text-white shadow-md font-black"
            : "bg-sage-800 hover:bg-sage-700 text-sage-200 font-medium";
        return `<button onclick="selectCategory('${cat.key}')"
                    class="px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-2 whitespace-nowrap transition-all ${activeClass}">
                    <i class="fa-solid ${cat.icon} text-xs"></i>
                    <span>${label}</span>
                </button>`;
    }).join('');
}

function updateBanner(catKey) {
    const catObj   = CATEGORIES.find(c => c.key === catKey);
    const filterEl = document.getElementById("activeFilterName");
    const titleEl  = document.getElementById("bannerTitle");
    const subEl    = document.getElementById("bannerSubtitle");
    const tagEl    = document.getElementById("bannerTagline");
    const heroImg  = document.getElementById("bannerHeroImage");
    const banner   = document.getElementById("categoryBanner");

    if (tagEl) tagEl.textContent = t('tagline');

    let heroSource = '/menu-images/ethiopia.jpg';
    if (catObj && catKey !== 'ALL') {
        const label = currentLang === 'en' ? catObj.en : catObj.am;
        if (filterEl) filterEl.textContent = label;
        if (titleEl)  titleEl.textContent  = label + (currentLang === 'en' ? ' — Menu' : ' — ዝርዝር');

        const sc = (API_CATEGORIES || CATEGORIES).find(c => c.key === catKey) || CATEGORIES.find(c => c.key === catKey);
        if (sc && subEl) subEl.textContent = currentLang === 'en' ? (sc.desc_en || sc.description_en || sc.en || sc.name_en) : (sc.desc_am || sc.description_am || sc.am || sc.name_am);
        if (sc && (sc.hero_img)) heroSource = sc.hero_img;
    } else {
        if (filterEl) filterEl.textContent = t('all_menu');
        if (titleEl)  titleEl.textContent  = t('banner_title');
        if (subEl)    subEl.textContent    = t('banner_sub');
    }

    if (heroImg) {
        heroImg.src = heroSource;
        heroImg.alt = catKey === 'ALL' ? 'Menu categories' : catKey;
        heroImg.style.display = 'block';
    }

    if (banner) {
        banner.style.backgroundImage = `linear-gradient(135deg, rgba(15,23,42,0.82), rgba(39,52,42,0.72)), url('${heroSource}')`;
        banner.style.backgroundSize = 'cover';
        banner.style.backgroundPosition = 'center';
    }
}

function selectCategory(catKey) {
    currentCategory = catKey;
    renderCategoryNavPills();
    updateBanner(catKey);
    renderMenuItems();
}

// ---- Menu Rendering ----
function renderMenuItems() {
    const container     = document.getElementById("itemsContainer");
    const emptyResults  = document.getElementById("emptyResults");
    const itemCountElem = document.getElementById("activeItemCount");
    const searchInput   = document.getElementById("searchInput");
    if (!container) return;

    const query  = searchInput ? (searchInput.value || '').trim().toLowerCase() : "";
    const tokens = query.split(/\s+/).filter(Boolean);

    let items = MENU_ITEMS.filter(i => i.available !== false);

    if (currentCategory !== "ALL") {
        items = items.filter(item => item.category === currentCategory);
    }
    if (tokens.length > 0) {
        items = items.filter(item => {
            const fields = [item.nameAm, item.nameEn, item.descAm, item.descEn, item.tagAm, item.tagEn]
                .map(f => (f || '').toString().toLowerCase());
            return tokens.every(t => fields.some(f => f.includes(t)));
        });
    }

    if (itemCountElem) itemCountElem.textContent = items.length;

    if (items.length === 0) {
        container.innerHTML = "";
        if (emptyResults) emptyResults.classList.remove("hidden");
        return;
    } else {
        if (emptyResults) emptyResults.classList.add("hidden");
    }

    const name  = item => currentLang === 'en' ? (item.nameEn || item.nameAm) : item.nameAm;
    const nameS = item => currentLang === 'en' ? item.nameAm : '';
    const desc  = item => currentLang === 'en'
        ? (item.descEn || item.descriptionEn || item.descAm || item.descriptionAm || '')
        : (item.descAm || item.descriptionAm || item.descEn || item.descriptionEn || '');
    const tag   = item => currentLang === 'en' ? (item.tagEn  || item.tagAm  || '') : (item.tagAm  || '');
    const cat   = item => currentLang === 'en' ? (item.catEn  || item.catAm  || '') : (item.catAm  || '');

    if (viewMode === "grid") {
        container.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5";
        container.innerHTML = items.map(item => `
            <div class="bg-white rounded-2xl border border-sage-200 overflow-hidden shadow-sm card-hover flex flex-col justify-between group cursor-pointer" onclick="openItemDetails(${item.id})">
                <div>
                    <div class="relative h-44 w-full overflow-hidden bg-sage-100">
                        <img src="${item.img}" alt="${name(item)}"
                             onerror="this.src='https://placehold.co/400x300/283728/ffffff?text=Food+Item'"
                             class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                        <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                            <span class="bg-sage-950/80 backdrop-blur-md text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-amber-500/30">${cat(item)}</span>
                            ${tag(item) ? `<span class="bg-terracotta-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow">${tag(item)}</span>` : ''}
                        </div>
                    </div>
                    <div class="p-3.5 space-y-1.5">
                        <h3 class="font-black text-sage-950 text-sm sm:text-base leading-snug font-amharic">${name(item)}</h3>
                        <p class="text-[11px] font-semibold text-terracotta-600 tracking-wide">${nameS(item)}</p>
                        <p class="text-xs text-sage-600 line-clamp-2 leading-relaxed">${desc(item)}</p>
                    </div>
                </div>
                <div class="px-3.5 pb-3.5 pt-2 border-t border-sage-100 flex items-center justify-between gap-2 mt-auto bg-cream-50/50">
                    <div>
                        <span class="text-[10px] text-sage-500 block font-medium">${t('price')}</span>
                        <span class="text-base font-black text-sage-900 font-mono">${item.price.toFixed(2)} <span class="text-xs font-bold text-terracotta-600">ETB</span></span>
                    </div>
                    <button type="button" onclick="event.stopPropagation(); openPaymentModal()" class="inline-flex items-center gap-1 bg-gradient-to-r from-amber-500 to-terracotta-500 text-white text-[10px] font-extrabold px-2.5 py-2 rounded-xl shadow-sm hover:from-amber-600 hover:to-terracotta-600 transition active:scale-95">
                        <i class="fa-solid fa-wallet text-[10px]"></i>
                        ${t('payment')}
                    </button>
                </div>
            </div>`).join('');
    } else {
        container.className = "space-y-2";
        container.innerHTML = items.map(item => `
            <div class="bg-white p-3 rounded-2xl border border-sage-200 shadow-sm flex items-center justify-between gap-3 hover:border-sage-400 transition cursor-pointer" onclick="openItemDetails(${item.id})">
                <div class="flex items-center gap-3 min-w-0">
                    <img src="${item.img}" alt="${name(item)}"
                         onerror="this.src='https://placehold.co/100x100/283728/ffffff?text=Item'"
                         class="w-14 h-14 rounded-xl object-cover shrink-0">
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                            <h3 class="font-extrabold text-sage-950 text-xs sm:text-sm truncate">${name(item)}</h3>
                            <span class="text-[10px] text-sage-500 truncate hidden sm:inline">(${nameS(item)})</span>
                        </div>
                        <p class="text-[11px] text-sage-600 truncate">${desc(item)}</p>
                        <span class="inline-block bg-sage-100 text-sage-800 text-[9px] font-bold px-2 py-0.5 rounded-md mt-0.5">${cat(item)}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <div class="text-right">
                        <span class="text-sm font-black text-sage-900 font-mono block">${item.price.toFixed(2)}</span>
                        <span class="text-[10px] text-terracotta-600 font-bold block">ETB</span>
                    </div>
                    <button type="button" onclick="event.stopPropagation(); openPaymentModal()" class="inline-flex items-center justify-center bg-gradient-to-r from-amber-500 to-terracotta-500 text-white text-[10px] font-extrabold px-2.5 py-2 rounded-xl shadow-sm hover:from-amber-600 to-terracotta-600 transition active:scale-95">
                        <i class="fa-solid fa-wallet text-[10px]"></i>
                    </button>
                </div>
            </div>`).join('');
    }
}

function openItemDetails(itemId) {
    const item = MENU_ITEMS.find(entry => entry.id === itemId);
    const modal = document.getElementById('itemDetailsModal');
    const content = document.getElementById('itemDetailsContent');
    if (!item || !modal || !content) return;
    const name = currentLang === 'en' ? (item.nameEn || item.nameAm) : item.nameAm;
    const secondaryName = currentLang === 'en' ? item.nameAm : (item.nameEn || '');
    const description = currentLang === 'en'
        ? (item.descEn || item.descriptionEn || item.descAm || item.descriptionAm || '')
        : (item.descAm || item.descriptionAm || item.descEn || item.descriptionEn || '');
    const category = currentLang === 'en' ? (item.catEn || item.catAm || '') : (item.catAm || item.catEn || '');
    content.innerHTML = `
        <img src="${item.img}" alt="${name}" class="w-full h-56 sm:h-72 object-cover">
        <div class="p-5 sm:p-6 space-y-3">
            <span class="inline-block bg-sage-100 text-sage-800 text-[10px] font-bold px-2.5 py-1 rounded-lg">${category}</span>
            <h2 class="text-xl sm:text-2xl font-black text-sage-950 font-amharic">${name}</h2>
            <p class="text-sm text-terracotta-600 font-semibold">${secondaryName}</p>
            <p class="text-sm text-sage-600 leading-relaxed">${description}</p>
            <div class="flex items-center justify-between border-t border-sage-100 pt-4">
                <strong class="text-xl text-sage-900 font-mono">${Number(item.price).toFixed(2)} <span class="text-xs text-terracotta-600">ETB</span></strong>
                <button type="button" onclick="closeItemDetails(); openPaymentModal()" class="bg-gradient-to-r from-amber-500 to-terracotta-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl"><i class="fa-solid fa-wallet mr-1"></i> ${t('payment')}</button>
            </div>
        </div>`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeItemDetails() {
    const modal = document.getElementById('itemDetailsModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

// ---- Search ----
function handleSearch() {
    const input    = document.getElementById("searchInput");
    const clearBtn = document.getElementById("clearSearchBtn");
    if (input && clearBtn) clearBtn.classList.toggle("hidden", input.value.length === 0);
    renderMenuItems();
}

function clearSearch() {
    const input    = document.getElementById("searchInput");
    const clearBtn = document.getElementById("clearSearchBtn");
    if (input)    input.value = "";
    if (clearBtn) clearBtn.classList.add("hidden");
    renderMenuItems();
}

function resetFilters() {
    currentCategory = "ALL";
    clearSearch();
    renderCategoryNavPills();
    updateBanner("ALL");
    renderMenuItems();
}

// ---- View Mode ----
function setViewMode(mode) {
    viewMode = mode;
    const gridBtn    = document.getElementById("viewBtnGrid");
    const compactBtn = document.getElementById("viewBtnCompact");
    const activeClass   = "px-2.5 py-1 rounded-lg bg-white shadow-sm text-sage-900 font-bold text-xs flex items-center gap-1 transition";
    const inactiveClass = "px-2.5 py-1 rounded-lg text-sage-600 hover:text-sage-900 text-xs flex items-center gap-1 transition";
    if (gridBtn)    gridBtn.className    = mode === "grid"    ? activeClass : inactiveClass;
    if (compactBtn) compactBtn.className = mode === "compact" ? activeClass : inactiveClass;
    renderMenuItems();
}

// ---- Utilities ----
function showToast(message) {
    const toast    = document.getElementById("toast");
    const toastMsg = document.getElementById("toastMsg");
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => { toast.classList.add("hidden"); }, 3000);
}

function getDefaultPaymentAccounts() {
    return [
        {
            id: 1,
            bank_key: 'CBE',
            bank_name: 'Commercial Bank of Ethiopia',
            account_holder: 'solomie Addisu',
            account_number: '1000345121351',
            dial_code: '*889#',
            color: '#5C1D52',
            active: true
        },
        {
            id: 2,
            bank_key: 'TELEBIRR',
            bank_name: 'Telebirr',
            account_holder: 'solomie Addisu',
            account_number: '0908071504',
            dial_code: '*127#',
            color: '#0054A6',
            active: true
        }
    ];
}

async function getPaymentAccounts() {
    try {
        const response = await fetch('/api/payment');
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length) {
                return data.filter(a => a.active !== false && a.active !== 0);
            }
        }
    } catch (e) {
        console.warn('Could not load payment data from API, using fallback', e);
    }
    return getDefaultPaymentAccounts();
}

async function renderPaymentAccounts() {
    const container = document.getElementById('paymentAccountsContainer');
    if (!container) return;

    const accounts = await getPaymentAccounts();
    if (!accounts.length) {
        container.innerHTML = `<p class="text-sm text-sage-600">${currentLang === 'am' ? 'የክፍያ መረጃ አልተገኘም።' : 'Payment details are not available.'}</p>`;
        return;
    }

    container.innerHTML = accounts.map((acc) => {
        const bankKey = (acc.bank_key || '').toUpperCase();
        const bankLabel = bankKey === 'CBE' ? 'CBE' : bankKey === 'TELEBIRR' ? 'telebirr' : (acc.bank_name || 'Wallet');
        const color = acc.color || '#5C1D52';
        const cardBg = bankKey === 'TELEBIRR' ? '#f0f9ff' : '#fdf7ef';
        const borderColor = color + '33';
        const numberLabel = bankKey === 'TELEBIRR' ? t('mobile_number') : t('account_number');
        const holder = acc.account_holder || 'solomie Addisu';
        const number = acc.account_number || '';
        const icon = bankKey === 'TELEBIRR' ? 'fa-mobile-screen-button' : 'fa-building-columns';

        return `
            <div class="rounded-2xl p-4 border space-y-2" style="background:${cardBg}; border-color:${borderColor};">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="text-white text-[11px] font-black px-2.5 py-1 rounded-lg" style="background:${color};">${bankLabel}</span>
                        <span class="font-extrabold text-xs text-sage-900">${currentLang === 'am' ? bankLabel : (acc.bank_name || 'Payment Method')}</span>
                    </div>
                    <i class="fa-solid ${icon} text-sm" style="color:${color};"></i>
                </div>

                <div class="space-y-1 pt-1">
                    <p class="text-[11px] text-sage-600 font-medium">${t('account_name')}</p>
                    <p class="text-sm font-black text-sage-950 bg-white px-3 py-1.5 rounded-xl border border-sage-200">
                        ${holder}
                    </p>
                </div>

                <div class="space-y-1">
                    <p class="text-[11px] text-sage-600 font-medium">${numberLabel}</p>
                    <div class="flex items-center gap-2">
                        <span class="flex-grow font-mono text-base font-black text-sage-900 bg-white px-3 py-2 rounded-xl border border-sage-300 tracking-wider">
                            ${number}
                        </span>
                        <div class="flex items-center gap-2 shrink-0">
                            <button onclick="copyToClipboard('${number}', '${acc.bank_name} Number')" class="text-white text-xs font-bold px-3 py-2.5 rounded-xl transition flex items-center gap-1" style="background:${color};">
                                <i class="fa-solid fa-copy"></i> ${t('copy')}
                            </button>
                            <a href="tel:${number}" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition flex items-center gap-1">
                                <i class="fa-solid fa-phone"></i> ${bankLabel}
                            </a>
                        </div>
                    </div>
                </div>

            </div>
        `;
    }).join('');
}

function openPaymentModal() {
    renderPaymentAccounts();
    const modal = document.getElementById('paymentModal');
    if (!modal) return;
    modal.classList.remove('hidden');
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (!modal) return;
    modal.classList.add('hidden');
}

async function copyToClipboard(value, label = 'Copied') {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
        } else {
            const temp = document.createElement('textarea');
            temp.value = value;
            temp.style.position = 'fixed';
            temp.style.opacity = '0';
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
        }
        showToast(label + ' copied');
    } catch (error) {
        console.error('Copy failed:', error);
        showToast('Copy failed');
    }
}
