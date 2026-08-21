(function () {
  'use strict';

  var LANG = (document.documentElement.getAttribute('lang') || 'ar').slice(0, 2);
  if (['ar', 'en', 'fr'].indexOf(LANG) === -1) LANG = 'ar';

  var RDMORE_TXT = { ar: 'اقرأ المقال →', en: 'Read the article →', fr: "Lire l'article →" };
  var SOURCE_TXT = { ar: 'المصدر', en: 'Source', fr: 'Source' };
  var NEW_BADGE_TXT = { ar: '📰 مستجد', en: '📰 New', fr: '📰 Nouveau' };
  var DISCOVERY_BADGE_TXT = { ar: '🆕 اكتشاف جديد', en: '🆕 New discovery', fr: '🆕 Nouvelle découverte' };

  function pick(field) {
    if (!field) return '';
    return field[LANG] || field.ar || field.en || '';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function renderHomeNews(items) {
    var list = document.getElementById('news-list');
    if (!list || !items || !items.length) return;

    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      if (!it || !it.id) continue;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'news-item reveal in';
      btn.setAttribute('data-auto-id', it.id);
      btn.onclick = (function (article) {
        return function () { openAutoArticle(article); };
      })(it);

      btn.innerHTML =
        '<span class="news-date">' + escapeHtml(pick(it.date)) + '</span>' +
        '<span class="news-txt">' +
        '<h4>' + escapeHtml(pick(it.title)) + '</h4>' +
        '<p>' + escapeHtml(pick(it.summary)) + '</p>' +
        '</span>' +
        '<span class="news-arrow">←</span>';

      list.insertBefore(btn, list.firstChild);
    }
  }

  function openAutoArticle(article) {
    var img = document.getElementById('auto-art-img');
    var badge = document.getElementById('auto-art-badge');
    var dateEl = document.getElementById('auto-art-date');
    var titleEl = document.getElementById('auto-art-title');
    var bodyEl = document.getElementById('auto-art-body');
    var sourceEl = document.getElementById('auto-art-source');
    if (!titleEl || !bodyEl) return;

    if (article.image) {
      img.src = article.image;
      img.alt = escapeHtml(pick(article.title));
      img.parentElement.style.display = '';
    } else if (img) {
      img.parentElement.style.display = 'none';
    }

    if (badge) {
      var badgeMap = article.category === 'discovery' ? DISCOVERY_BADGE_TXT : NEW_BADGE_TXT;
      badge.textContent = badgeMap[LANG] || badgeMap.ar;
    }
    if (dateEl) dateEl.textContent = pick(article.date);
    titleEl.textContent = pick(article.title);

    var bodyItems = (article.body && (article.body[LANG] || article.body.ar || article.body.en)) || [];
    var html = '';
    bodyItems.forEach(function (p) {
      html += '<p>' + escapeHtml(p) + '</p>';
    });
    bodyEl.innerHTML = html || '<p>' + escapeHtml(pick(article.summary)) + '</p>';

    if (sourceEl) {
      if (article.source_url) {
        sourceEl.innerHTML =
          '<a href="' + escapeHtml(article.source_url) + '" target="_blank" rel="noopener noreferrer">' +
          (SOURCE_TXT[LANG] || SOURCE_TXT.ar) + (article.source_name ? ': ' + escapeHtml(article.source_name) : '') +
          '</a>';
      } else {
        sourceEl.innerHTML = '';
      }
    }

    if (typeof showPage === 'function') showPage('auto');
  }
  window.openAutoArticle = openAutoArticle;

  var CATEGORY_TO_PAGE_CONTAINER = {
    river: 'water-updates',
    desert: 'desert-updates',
    pollution: 'pollution-updates',
    sinkhole: 'cavefish-updates'
  };

  function buildGuItemHtml(it) {
    var html = '<div class="gu-item">';
    html += '<span class="gu-date">' + escapeHtml(pick(it.date)) + '</span>';
    html += '<h5>' + escapeHtml(pick(it.title)) + '</h5>';
    html += '<p>' + escapeHtml(pick(it.summary)) + '</p>';
    if (it.source_url) {
      html += '<a href="' + escapeHtml(it.source_url) + '" target="_blank" rel="noopener noreferrer">' +
        (SOURCE_TXT[LANG] || SOURCE_TXT.ar) + (it.source_name ? ': ' + escapeHtml(it.source_name) : '') + '</a>';
    }
    html += '</div>';
    return html;
  }

  function renderPageUpdates(homeNews) {
    if (!homeNews || !homeNews.length) return;
    var byPage = {};

    homeNews.forEach(function (it) {
      var containerId = CATEGORY_TO_PAGE_CONTAINER[it.category];
      if (!containerId) return;
      if (!byPage[containerId]) byPage[containerId] = [];
      byPage[containerId].push(it);
    });

    Object.keys(byPage).forEach(function (containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;
      var items = byPage[containerId];
      var html = '<div class="gu-h"><span class="dotlive"></span>' +
        (LANG === 'ar' ? 'آخر التطورات' : LANG === 'fr' ? 'Derniers développements' : 'Latest developments') +
        '</div>';
      items.forEach(function (it) { html += buildGuItemHtml(it); });
      container.innerHTML = html;
    });
  }

  function renderGlobalUpdates(globalUpdates) {
    if (!globalUpdates) return;
    ['amazon', 'ocean', 'climate'].forEach(function (topic) {
      var container = document.getElementById(topic + '-updates');
      var items = globalUpdates[topic];
      if (!container || !items || !items.length) return;

      var html = '<div class="gu-h"><span class="dotlive"></span>' +
        (LANG === 'ar' ? 'آخر التطورات' : LANG === 'fr' ? 'Derniers développements' : 'Latest developments') +
        '</div>';

      items.forEach(function (it) {
        html += buildGuItemHtml(it);
      });

      container.innerHTML = html;
    });
  }

  function init() {
    fetch('data/news.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        renderHomeNews(data.home_news);
        renderPageUpdates(data.home_news);
        renderGlobalUpdates(data.global_updates);
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
