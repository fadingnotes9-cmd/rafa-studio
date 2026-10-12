/* ============================================================
   save.js — LocalStorage Manager (Projects + API Keys)
   ============================================================ */

const Store = (() => {

  const KEY_PROJECTS = 'sl_projects';
  const KEY_APIKEYS = 'sl_api_keys';
  const KEY_DEFAULTS = 'sl_defaults';

  // ============ API KEYS ============
  function getApiKeys() {
    try {
      const raw = localStorage.getItem(KEY_APIKEYS);
      return raw ? JSON.parse(raw) : { deepseek: '', pexels: '', pixabay: '', cloudflare_id: '', cloudflare_token: '' };
    } catch (e) {
      return { deepseek: '', pexels: '', pixabay: '', cloudflare_id: '', cloudflare_token: '' };
    }
  }

  function saveApiKeys(keys) {
    localStorage.setItem(KEY_APIKEYS, JSON.stringify({
      deepseek: keys.deepseek || '',
      pexels: keys.pexels || '',
      pixabay: keys.pixabay || '',
      cloudflare_id: keys.cloudflare_id || '',
      cloudflare_token: keys.cloudflare_token || ''
    }));
  }

  // ============ DEFAULTS ============
  function getDefaults() {
    try {
      const raw = localStorage.getItem(KEY_DEFAULTS);
      return raw ? JSON.parse(raw) : { style: 'Realistis', bahasa: 'Indonesia' };
    } catch (e) {
      return { style: 'Realistis', bahasa: 'Indonesia' };
    }
  }

  function saveDefaults(d) {
    localStorage.setItem(KEY_DEFAULTS, JSON.stringify(d));
  }

  // ============ PROJECTS ============
  function getAllProjects() {
    try {
      const raw = localStorage.getItem(KEY_PROJECTS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveProject(project) {
    const all = getAllProjects();
    const now = Date.now();
    if (!project.id) {
      project.id = 'proj_' + Math.random().toString(36).slice(2, 10);
      project.createdAt = now;
    }
    project.updatedAt = now;

    const idx = all.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      all[idx] = project;
    } else {
      all.unshift(project);
    }
    localStorage.setItem(KEY_PROJECTS, JSON.stringify(all));
    return project;
  }

  function getProject(id) {
    return getAllProjects().find(p => p.id === id) || null;
  }

  function deleteProject(id) {
    const all = getAllProjects().filter(p => p.id !== id);
    localStorage.setItem(KEY_PROJECTS, JSON.stringify(all));
  }

  function clearAllProjects() {
    localStorage.removeItem(KEY_PROJECTS);
  }

  // ============ EXPORT / IMPORT ============
  function exportAll() {
    return {
      version: 1,
      exportedAt: Date.now(),
      projects: getAllProjects()
    };
  }

  function importAll(data) {
    if (!data || !Array.isArray(data.projects)) {
      throw new Error('Format backup tidak valid');
    }
    localStorage.setItem(KEY_PROJECTS, JSON.stringify(data.projects));
  }

  // ============ PUBLIC API ============
  return {
    getApiKeys, saveApiKeys,
    getDefaults, saveDefaults,
    getAllProjects, saveProject, getProject, deleteProject, clearAllProjects,
    exportAll, importAll
  };

})();

window.Store = Store;
