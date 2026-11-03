// Generates the other names a country goes by, for matching a pasted route: official and native names,
// spellings from `world-countries`, its Turkish and Russian translations, plus common English and
// Azerbaijani names written by hand. Only ever used to recognise a name, never shown.
// Run: node scripts/gen-country-aliases.mjs
import countries from "world-countries";
import { writeFileSync } from "node:fs";

const ENGLISH = {
  AE: ["UAE", "Emirates"],
  BA: ["Bosnia", "Bosnia-Herzegovina", "Herzegovina", "BiH"],
  BN: ["Brunei Darussalam"],
  BO: ["Plurinational State of Bolivia"],
  CD: ["DRC", "D.R. Congo", "Democratic Republic of Congo", "Congo-Kinshasa", "Congo Kinshasa", "Zaire"],
  CG: ["Republic of Congo", "Congo-Brazzaville", "Congo Brazzaville"],
  CI: ["Ivory Coast", "Cote d'Ivoire"],
  CV: ["Cape Verde", "Cabo Verde"],
  CZ: ["Czech Republic", "Czechia"],
  FM: ["Micronesia", "FSM"],
  GB: ["UK", "U.K.", "Britain", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland"],
  KP: ["DPRK", "Democratic People's Republic of Korea"],
  KR: ["Republic of Korea", "ROK"],
  LA: ["Lao PDR", "Lao"],
  MK: ["Macedonia", "FYROM"],
  MM: ["Burma"],
  NL: ["Holland", "The Netherlands"],
  PS: ["State of Palestine", "Palestinian Territories", "West Bank", "Gaza"],
  RU: ["Russian Federation"],
  SY: ["Syrian Arab Republic"],
  SZ: ["Swaziland", "eSwatini"],
  TL: ["East Timor", "Timor Leste"],
  TR: ["Turkey", "Turkiye", "Republic of Turkey"],
  TZ: ["United Republic of Tanzania"],
  US: ["USA", "U.S.", "U.S.A.", "America", "United States of America", "United States"],
  VA: ["Vatican", "Vatican City", "Holy See"],
  VE: ["Bolivarian Republic of Venezuela"],
  VN: ["Viet Nam"],
};

const AZERBAIJANI = {
  AD: ["Andorra"], AE: ["Birləşmiş Ərəb Əmirlikləri", "BƏƏ"], AF: ["Əfqanıstan"], AG: ["Antiqua və Barbuda"], AL: ["Albaniya"], AM: ["Ermənistan"], AO: ["Anqola"], AR: ["Argentina"], AT: ["Avstriya"], AU: ["Avstraliya"], AZ: ["Azərbaycan"],
  BA: ["Bosniya və Herseqovina", "Bosniya"], BB: ["Barbados"], BD: ["Banqladeş"], BE: ["Belçika"], BF: ["Burkina Faso"], BG: ["Bolqarıstan"], BH: ["Bəhreyn"], BI: ["Burundi"], BJ: ["Benin"], BN: ["Bruney"], BO: ["Boliviya"], BR: ["Braziliya"], BS: ["Baham adaları"], BT: ["Butan"], BW: ["Botsvana"], BY: ["Belarus"], BZ: ["Beliz"],
  CA: ["Kanada"], CD: ["Konqo Demokratik Respublikası"], CF: ["Mərkəzi Afrika Respublikası"], CG: ["Konqo Respublikası"], CH: ["İsveçrə"], CI: ["Kot-d'İvuar", "Fil Dişi Sahili"], CL: ["Çili"], CM: ["Kamerun"], CN: ["Çin"], CO: ["Kolumbiya"], CR: ["Kosta-Rika", "Kosta Rika"], CU: ["Kuba"], CV: ["Kabo-Verde", "Kabo Verde"], CY: ["Kipr"], CZ: ["Çexiya", "Çex Respublikası"],
  DE: ["Almaniya"], DJ: ["Cibuti"], DK: ["Danimarka"], DM: ["Dominika"], DO: ["Dominikan Respublikası"], DZ: ["Əlcəzair"],
  EC: ["Ekvador"], EE: ["Estoniya"], EG: ["Misir"], ER: ["Eritreya"], ES: ["İspaniya"], ET: ["Efiopiya"],
  FI: ["Finlandiya"], FJ: ["Fici"], FM: ["Mikroneziya"], FR: ["Fransa"],
  GA: ["Qabon"], GB: ["Böyük Britaniya", "Birləşmiş Krallıq", "İngiltərə"], GD: ["Qrenada"], GE: ["Gürcüstan"], GH: ["Qana"], GM: ["Qambiya"], GN: ["Qvineya"], GQ: ["Ekvatorial Qvineya"], GR: ["Yunanıstan"], GT: ["Qvatemala"], GW: ["Qvineya-Bisau"], GY: ["Qayana"],
  HN: ["Honduras"], HR: ["Xorvatiya"], HT: ["Haiti"], HU: ["Macarıstan"],
  ID: ["İndoneziya"], IE: ["İrlandiya"], IL: ["İsrail"], IN: ["Hindistan"], IQ: ["İraq"], IR: ["İran"], IS: ["İslandiya"], IT: ["İtaliya"],
  JM: ["Yamayka"], JO: ["İordaniya"], JP: ["Yaponiya"],
  KE: ["Keniya"], KG: ["Qırğızıstan"], KH: ["Kamboca"], KI: ["Kiribati"], KM: ["Komor adaları"], KN: ["Sent-Kits və Nevis"], KP: ["Şimali Koreya"], KR: ["Cənubi Koreya"], KW: ["Küveyt"], KZ: ["Qazaxıstan"],
  LA: ["Laos"], LB: ["Livan"], LC: ["Sent-Lüsiya"], LI: ["Lixtenşteyn"], LK: ["Şri-Lanka", "Şri Lanka"], LR: ["Liberiya"], LS: ["Lesoto"], LT: ["Litva"], LU: ["Lüksemburq"], LV: ["Latviya"], LY: ["Liviya"],
  MA: ["Mərakeş"], MC: ["Monako"], MD: ["Moldova"], ME: ["Monteneqro", "Qaradağ"], MG: ["Madaqaskar"], MH: ["Marşall adaları"], MK: ["Şimali Makedoniya", "Makedoniya"], ML: ["Mali"], MM: ["Myanma"], MN: ["Monqolustan"], MR: ["Mavritaniya"], MT: ["Malta"], MU: ["Mavriki"], MV: ["Maldiv adaları", "Maldiv"], MW: ["Malavi"], MX: ["Meksika"], MY: ["Malayziya"], MZ: ["Mozambik"],
  NA: ["Namibiya"], NE: ["Niger"], NG: ["Nigeriya"], NI: ["Nikaraqua"], NL: ["Niderland", "Hollandiya"], NO: ["Norveç"], NP: ["Nepal"], NR: ["Nauru"], NZ: ["Yeni Zelandiya"],
  OM: ["Oman"],
  PA: ["Panama"], PE: ["Peru"], PG: ["Papua-Yeni Qvineya", "Papua Yeni Qvineya"], PH: ["Filippin"], PK: ["Pakistan"], PL: ["Polşa"], PS: ["Fələstin"], PT: ["Portuqaliya"], PW: ["Palau"], PY: ["Paraqvay"],
  QA: ["Qətər"],
  RO: ["Rumıniya"], RS: ["Serbiya"], RU: ["Rusiya"], RW: ["Ruanda"],
  SA: ["Səudiyyə Ərəbistanı"], SB: ["Solomon adaları"], SC: ["Seyşel adaları"], SD: ["Sudan"], SE: ["İsveç"], SG: ["Sinqapur"], SI: ["Sloveniya"], SK: ["Slovakiya"], SL: ["Syerra-Leone"], SM: ["San-Marino"], SN: ["Seneqal"], SO: ["Somali"], SR: ["Surinam"], SS: ["Cənubi Sudan"], ST: ["San-Tome və Prinsipi"], SV: ["Salvador"], SY: ["Suriya"], SZ: ["Esvatini", "Svazilend"],
  TD: ["Çad"], TG: ["Toqo"], TH: ["Tailand"], TJ: ["Tacikistan"], TL: ["Şərqi Timor"], TM: ["Türkmənistan"], TN: ["Tunis"], TO: ["Tonqa"], TR: ["Türkiyə"], TT: ["Trinidad və Tobaqo"], TV: ["Tuvalu"], TW: ["Tayvan"], TZ: ["Tanzaniya"],
  UA: ["Ukrayna"], UG: ["Uqanda"], US: ["ABŞ", "Amerika Birləşmiş Ştatları", "Amerika"], UY: ["Uruqvay"], UZ: ["Özbəkistan"],
  VA: ["Vatikan"], VC: ["Sent-Vinsent və Qrenadinlər"], VE: ["Venesuela"], VN: ["Vyetnam"], VU: ["Vanuatu"],
  WS: ["Samoa"],
  XK: ["Kosovo"],
  YE: ["Yəmən"],
  ZA: ["Cənubi Afrika", "Cənubi Afrika Respublikası"], ZM: ["Zambiya"], ZW: ["Zimbabve"],
};

const out = {};
for (const c of countries) {
  const names = new Set([
    c.name.common,
    c.name.official,
    ...Object.values(c.name.native ?? {}).flatMap((n) => [n.common, n.official]),
    ...(c.altSpellings ?? []),
    c.translations?.tur?.common,
    c.translations?.tur?.official,
    c.translations?.rus?.common,
    ...(ENGLISH[c.cca2] ?? []),
    ...(AZERBAIJANI[c.cca2] ?? []),
  ]);
  names.delete(undefined);
  names.delete(c.cca2);
  out[c.cca2] = [...names];
}

writeFileSync(new URL("../lib/data/country-aliases.json", import.meta.url), JSON.stringify(out));
console.log(`wrote aliases for ${Object.keys(out).length} countries`);
