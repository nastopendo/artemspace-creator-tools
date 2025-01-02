import { translations } from "../translations";

class LanguageService {
  constructor() {
    this.currentLanguage = this.getInitialLanguage();
    this.translations = translations;
  }

  getInitialLanguage() {
    // Check localStorage first
    const savedLang = localStorage.getItem("language");
    if (savedLang && ["en", "pl"].includes(savedLang)) {
      return savedLang;
    }

    // Check browser language
    const browserLang = navigator.language.split("-")[0];
    return ["en", "pl"].includes(browserLang) ? browserLang : "en";
  }

  setLanguage(lang) {
    if (this.translations[lang]) {
      this.currentLanguage = lang;
      localStorage.setItem("language", lang);
      this.updatePageTranslations();
    }
  }

  translate(key) {
    return this.translations[this.currentLanguage][key] || key;
  }

  updatePageTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      element.textContent = this.translate(key);
    });
  }
}

export const languageService = new LanguageService();
