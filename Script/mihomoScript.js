/**
 * MyClash 手动节点整合版
 *
 * 基于 AIsouler/MyClash 当前全量版 mihomoScript.js 的思路整合：
 * 1. 删除「手动选择 / 自动选择 / 负载均衡」三套基础节点组
 * 2. 删除香港 / 日本 / 美国 / 新加坡 / 台湾省 / 低倍率 / 高倍率 / 其他节点等内置节点组
 * 3. 仅保留一个「节点选择」select 组，直接平铺全部过滤后的机场节点
 * 4. 保留 MyClash 的服务分流体系与开关：FCM / YouTube / Google / AI / Microsoft /
 *    Apple / Telegram / Steam / TikTok / Instagram / Netflix / Twitter / Emby /
 *    PikPak / Spotify / Crypto / EHentai / AdBlock
 * 5. 加入用户原脚本 FANZA 规则集，并提供 FANZA 的日本节点快捷选择
 * 6. 保留 MyClash 的节点标准化、节点过滤、dialer-proxy 修复、IP 版本偏好
 * 7. 保留 MyClash 的 DNS / Hosts / 私有 DNS / fake-ip / Hosts -> proxy.server 改写逻辑
 * 8. 保留 MyClash 的国内外规则、国外 QUIC 拦截及服务 Rule Providers
 *
 * 重要：本版不创建 url-test / load-balance，不做自动测速，不做自动故障转移。
 * 9. 兼容 proxy-providers：存在代理提供器时，节点组通过 include-all-providers 纳入提供器节点。
 * 10. 默认关闭 TUN / NTP / LAN / IPv6，保留规则模式、节点选择持久化和本地 API。
 */

const Compatible_With_Bettbox = { ruleOptionsEnable: true };

// ==================== 开关 ====================
const ruleOptionsEnable = {
  // 唯一节点入口
  节点选择: true,

  // 服务分流开关
  FCM: false,
  YouTube: true,
  Google: true,
  AI: true,
  Microsoft: true,
  Apple: false,
  Telegram: true,
  Steam: true,
  TikTok: false,
  Twitter: true,
  Instagram: false,
  Netflix: false,
  Emby: false,
  PikPak: false,
  Spotify: false,
  Crypto: false,
  EHentai: true,
  AdBlock: true,

  // 用户额外加入
  FANZA: true,

  // MyClash 原有非分流功能
  过滤低倍率节点: false,
  过滤高倍率节点: false,
  过滤非地区节点: true,
  屏蔽国外QUIC: true,
  代理IPV4优先: false,
  代理IPV6优先: false,
  链式代理: false,
};

// ==================== 前置规则 ====================
const prefixRules = [
  'RULE-SET,private,直连',
  'RULE-SET,geolocation-cn,直连',
  'RULE-SET,epicgames,直连',
  'RULE-SET,nvidia_cn,直连',
  'RULE-SET,apple_cn,直连',
  'RULE-SET,microsoft_cn,直连',
  'DOMAIN,fsend.cn,直连',
  'DOMAIN,international-gfe.download.nvidia.com,直连',
];

// ==================== 自建节点（默认不启用） ====================
const customizeProxies = [];
const dialerProxyName = '链式中转';

// ==================== 节点过滤 ====================
const excludeFilter =
  /群|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|电报|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|超时|收藏|优惠|福利|邀请|好友|失联|选择|剩余|公益|发布|DIZTNA|通路|登录|禁止|定时|渠道|牢记|永久|余额|阁下|本站|刷新|导航|建议|重置|以下|过滤|⚠️|@|t\.me\/\+|\bexpire\b|\bhttps?:\/\/|\.com|\btraffic\b/iu;

// ==================== 国外 QUIC ====================
const blockForeignQuic = [
  'AND,((NETWORK,UDP),(DST-PORT,443),(NOT,((OR,((RULE-SET,cn_additional),(RULE-SET,cn_ip,no-resolve)))))),REJECT',
];

// ==================== 直连节点 ====================
const directProxies = [
  { name: '🇨🇳 直连 | 双栈', type: 'direct' },
  { name: '🇨🇳 直连 | IPv4优先', type: 'direct', 'ip-version': 'ipv4-prefer' },
  { name: '🇨🇳 直连 | IPv6优先', type: 'direct', 'ip-version': 'ipv6-prefer' },
  { name: '🇨🇳 直连 | 仅IPv4', type: 'direct', 'ip-version': 'ipv4' },
  { name: '🇨🇳 直连 | 仅IPv6', type: 'direct', 'ip-version': 'ipv6' },
];

// ==================== 地区识别：保留用于节点标准化 / FANZA 快捷筛选，不生成地区代理组 ====================
const regionDefinitions = [
  {
    name: '香港',
    flag: '🇭🇰',
    regex: /🇭🇰|香港|(?<![A-Za-z])HKG?(?![A-Za-z])|hong\s*kong/i,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Hong_Kong.png',
  },
  {
    name: '日本',
    flag: '🇯🇵',
    regex: /🇯🇵|日本|东京|大阪|京都|(?<![A-Za-z])JPN?(?![A-Za-z])|japan/i,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Japan.png',
  },
  {
    name: '美国',
    flag: '🇺🇸',
    regex:
      /🇺🇸|美国|纽约|洛杉矶|旧金山|芝加哥|休斯顿|迈阿密|西雅图|波士顿|华盛顿|拉斯维加斯|圣何塞|圣地亚哥|(?<![A-Za-z])USA?(?![A-Za-z])|america|united\s*states/i,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/United_States.png',
  },
  {
    name: '新加坡',
    flag: '🇸🇬',
    regex: /🇸🇬|新加坡|狮城|(?<![A-Za-z])SGP?(?![A-Za-z])|singapore/i,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Singapore.png',
  },
  {
    name: '台湾省',
    flag: '🇹🇼',
    regex: /🇹🇼|台湾|台北|高雄|(?<![A-Za-z])TWN?(?![A-Za-z])|taiwan/i,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Taiwan.png',
  },
];

const lowRateRegionName = '低倍率节点';
const highRateRegionName = '高倍率节点';
const rateRegionDefinitions = [
  {
    name: lowRateRegionName,
    regex:
      /^(?!.*(?:剩|期)).*(?:(?<!\d)0\.[0-5]|(?<=[ |｜丨∣┃\-‐–—−－﹣])0[*×✕✖⨯⨉x倍])|(?:(?<=[ |｜丨∣┃\-‐–—−－﹣])[*×✕✖⨯⨉x]0(?= |倍|$))|^(?!.*(?:客户端|软件)).*下载|低倍|免费|(?<![A-Za-z])free(?![A-Za-z])/i,
  },
  {
    name: highRateRegionName,
    regex:
      /(?<=[ |｜丨∣┃\-‐–—−－﹣])((?:[*×✕✖⨯⨉x]\s*(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?)|(?:(?<![\d.])(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?\s*(?:倍|[*×✕✖⨯⨉x])))/i,
  },
];
const allRegionDefinitions = [...regionDefinitions, ...rateRegionDefinitions];

// ==================== Rule Providers 基础配置 ====================
const ruleProviderCommonDomain = {
  type: 'http',
  format: 'mrs',
  interval: 86400,
  behavior: 'domain',
};
const ruleProviderCommonIpcidr = {
  type: 'http',
  format: 'mrs',
  interval: 86400,
  behavior: 'ipcidr',
};

const baseRuleProviders = {
  private: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/private.mrs',
    path: './ruleset/private.mrs',
    'path-in-bundle': 'geo/geosite/private.mrs',
  },
  private_ip: {
    ...ruleProviderCommonIpcidr,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/private.mrs',
    path: './ruleset/private_ip.mrs',
    'path-in-bundle': 'geo/geoip/private_ip.mrs',
  },
  games_cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/category-games@cn.mrs',
    path: './ruleset/category-games@cn.mrs',
    'path-in-bundle': 'geo/geosite/category-games@cn.mrs',
  },
  epicgames: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/epicgames.mrs',
    path: './ruleset/epicgames.mrs',
    'path-in-bundle': 'geo/geosite/epicgames.mrs',
  },
  nvidia_cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/nvidia@cn.mrs',
    path: './ruleset/nvidia@cn.mrs',
    'path-in-bundle': 'geo/geosite/nvidia@cn.mrs',
  },
  apple_cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/apple@cn.mrs',
    path: './ruleset/apple@cn.mrs',
    'path-in-bundle': 'geo/geosite/apple@cn.mrs',
  },
  microsoft_cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/microsoft@cn.mrs',
    path: './ruleset/microsoft@cn.mrs',
    'path-in-bundle': 'geo/geosite/microsoft@cn.mrs',
  },
  'geolocation-cn': {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/geolocation-cn.mrs',
    path: './ruleset/geolocation-cn.mrs',
    'path-in-bundle': 'geo/geosite/geolocation-cn.mrs',
  },
  cn_ip: {
    ...ruleProviderCommonIpcidr,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/cn.mrs',
    path: './ruleset/cn_ip.mrs',
    'path-in-bundle': 'geo/geoip/cn.mrs',
  },
  'geolocation-!cn': {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/geolocation-!cn.mrs',
    path: './ruleset/geolocation-!cn.mrs',
    'path-in-bundle': 'geo/geosite/geolocation-!cn.mrs',
  },
  fakeip_filter: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/fakeip-filter.mrs',
    path: './ruleset/fakeip-filter.mrs',
    'path-in-bundle': 'geo/geosite/fakeip-filter.mrs',
  },
  cn_additional: {
    ...ruleProviderCommonDomain,
    url: 'https://static-file-global.353355.xyz/rules/cn-additional-list.mrs',
    path: './ruleset/cn-additional-list.mrs',
    'path-in-bundle': 'geo/geosite/cn.mrs',
  },
  cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/cn.mrs',
    path: './ruleset/cn.mrs',
    'path-in-bundle': 'geo/geosite/cn.mrs',
  },
};

// ==================== 纯手动节点组 ====================
const selectBaseOption = {
  type: 'select',
};

const nodeSelectGroup = {
  ...selectBaseOption,
  name: '节点选择',
  icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Static.png',
};

function hasProxyProviders(config) {
  return !!(config?.['proxy-providers'] && typeof config['proxy-providers'] === 'object' && Object.keys(config['proxy-providers']).length);
}

function getProxyProviderNames(config) {
  return hasProxyProviders(config) ? Object.keys(config['proxy-providers']) : [];
}

// ==================== 服务分流配置 ====================
const serviceConfigs = [
  {
    name: 'FCM',
    direct: true,
    defaultSelected: '直连',
    providers: {
      googlefcm: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/googlefcm.mrs',
        path: './ruleset/googlefcm.mrs',
        'path-in-bundle': 'geo/geosite/googlefcm.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/MiToverG422/Qure@master/IconSet/Color/fcm.png',
    rules: ['RULE-SET,googlefcm,GLOBAL'],
  },
  {
    name: 'YouTube',
    providers: {
      youtube: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/youtube.mrs',
        path: './ruleset/youtube.mrs',
        'path-in-bundle': 'geo/geosite/youtube.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/YouTube.png',
    rules: ['RULE-SET,youtube,GLOBAL'],
  },
  {
    name: 'Google',
    providers: {
      google: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/google.mrs',
        path: './ruleset/google.mrs',
        'path-in-bundle': 'geo/geosite/google.mrs',
      },
      google_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/google.mrs',
        path: './ruleset/google_ip.mrs',
        'path-in-bundle': 'geo/geoip/google.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Google_Search.png',
    rules: ['RULE-SET,google,GLOBAL', 'RULE-SET,google_ip,GLOBAL,no-resolve'],
  },
  {
    name: 'AI',
    providers: {
      ai: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/category-ai-!cn.mrs',
        path: './ruleset/ai.mrs',
        'path-in-bundle': 'geo/geosite/category-ai-!cn.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png',
    rules: ['RULE-SET,ai,GLOBAL'],
  },
  {
    name: 'Microsoft',
    direct: true,
    providers: {
      github: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/github.mrs',
        path: './ruleset/github.mrs',
        'path-in-bundle': 'geo/geosite/github.mrs',
      },
      microsoft: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/microsoft.mrs',
        path: './ruleset/microsoft.mrs',
        'path-in-bundle': 'geo/geosite/microsoft.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Microsoft.png',
    // MyClash 原规则这里指向「默认代理」；整合版已改为唯一节点入口「节点选择」
    rules: ['RULE-SET,github,GLOBAL', 'RULE-SET,microsoft,GLOBAL'],
  },
  {
    name: 'Apple',
    direct: true,
    providers: {
      apple: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/apple.mrs',
        path: './ruleset/apple.mrs',
        'path-in-bundle': 'geo/geosite/apple.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Apple.png',
    rules: ['RULE-SET,apple,GLOBAL'],
  },
  {
    name: 'Telegram',
    providers: {
      telegram: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/telegram.mrs',
        path: './ruleset/telegram.mrs',
        'path-in-bundle': 'geo/geosite/telegram.mrs',
      },
      telegram_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/telegram.mrs',
        path: './ruleset/telegram_ip.mrs',
        'path-in-bundle': 'geo/geoip/telegram.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Telegram.png',
    rules: ['RULE-SET,telegram,GLOBAL', 'RULE-SET,telegram_ip,GLOBAL,no-resolve'],
  },
  {
    name: 'Steam',
    direct: true,
    providers: {
      steam: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/steam.mrs',
        path: './ruleset/steam.mrs',
        'path-in-bundle': 'geo/geosite/steam.mrs',
      },
      steam_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/steam.mrs',
        path: './ruleset/steam_ip.mrs',
        'path-in-bundle': 'geo/geoip/steam.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Steam.png',
    rules: ['RULE-SET,steam,GLOBAL', 'RULE-SET,steam_ip,GLOBAL,no-resolve'],
  },
  {
    name: 'TikTok',
    providers: {
      tiktok: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/tiktok.mrs',
        path: './ruleset/tiktok.mrs',
        'path-in-bundle': 'geo/geosite/tiktok.mrs',
      },
      tiktok_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/tiktok.mrs',
        path: './ruleset/tiktok_ip.mrs',
        'path-in-bundle': 'geo/geoip/tiktok.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/TikTok.png',
    rules: ['RULE-SET,tiktok,GLOBAL', 'RULE-SET,tiktok_ip,GLOBAL,no-resolve'],
  },
  {
    name: 'Twitter',
    providers: {
      twitter: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/twitter.mrs',
        path: './ruleset/twitter.mrs',
        'path-in-bundle': 'geo/geosite/twitter.mrs',
      },
      twitter_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/twitter.mrs',
        path: './ruleset/twitter_ip.mrs',
        'path-in-bundle': 'geo/geoip/twitter.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Twitter.png',
    rules: ['RULE-SET,twitter,GLOBAL', 'RULE-SET,twitter_ip,GLOBAL,no-resolve'],
  },
  {
    name: 'Instagram',
    providers: {
      instagram: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/instagram.mrs',
        path: './ruleset/instagram.mrs',
        'path-in-bundle': 'geo/geosite/instagram.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Instagram.png',
    rules: ['RULE-SET,instagram,GLOBAL'],
  },
  {
    name: 'Netflix',
    providers: {
      netflix: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/netflix.mrs',
        path: './ruleset/netflix.mrs',
        'path-in-bundle': 'geo/geosite/netflix.mrs',
      },
      netflix_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/netflix.mrs',
        path: './ruleset/netflix_ip.mrs',
        'path-in-bundle': 'geo/geoip/netflix.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Netflix.png',
    rules: ['RULE-SET,netflix,GLOBAL', 'RULE-SET,netflix_ip,GLOBAL,no-resolve'],
  },
  {
    name: 'Emby',
    direct: true,
    providers: {
      emby: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/666OS/rules@release/mihomo/domain/Emby.mrs',
        path: './ruleset/emby.mrs',
        'path-in-bundle': 'geo/geosite/category-emby.mrs',
      },
      emos: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/binaryu/emos-proxy-rule@main/rules/emos-mihomo.mrs',
        path: './ruleset/emos.mrs',
        'path-in-bundle': 'geo/geosite/category-emby.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Emby.png',
    rules: [
      'RULE-SET,emby,GLOBAL',
      'RULE-SET,emos,GLOBAL',
      'DOMAIN-SUFFIX,mb3admin.com,GLOBAL',
      'DOMAIN-SUFFIX,nubebelle.com,GLOBAL',
      'DOMAIN-KEYWORD,emby,GLOBAL',
      'PROCESS-NAME,com.mb.android,GLOBAL',
      'PROCESS-NAME,tv.emby.embyatv,GLOBAL',
      'PROCESS-NAME,com.hush.yamby,GLOBAL',
      'PROCESS-NAME,com.jellycine.app,GLOBAL',
      'PROCESS-NAME,com.mountains.hills,GLOBAL',
      'PROCESS-NAME,RodelPlayer.App.exe,GLOBAL',
      'PROCESS-NAME,com.feifeiduck.capyplayer,GLOBAL',
    ],
  },
  {
    name: 'PikPak',
    direct: true,
    providers: {
      pikpak: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/pikpak.mrs',
        path: './ruleset/pikpak.mrs',
        'path-in-bundle': 'geo/geosite/pikpak.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/lige47/QuanX-icon-rule@main/icon/03CNSoft/pikpak.png',
    rules: ['RULE-SET,pikpak,GLOBAL'],
  },
  {
    name: 'Spotify',
    direct: true,
    providers: {
      spotify: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/spotify.mrs',
        path: './ruleset/spotify.mrs',
        'path-in-bundle': 'geo/geosite/spotify.mrs',
      },
      spotify_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/spotify.mrs',
        path: './ruleset/spotify_ip.mrs',
        'path-in-bundle': 'geo/geoip/spotify.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Spotify.png',
    rules: ['RULE-SET,spotify,GLOBAL', 'RULE-SET,spotify_ip,GLOBAL,no-resolve'],
  },
  {
    name: 'Crypto',
    providers: {
      cryptocurrency: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/category-cryptocurrency.mrs',
        path: './ruleset/cryptocurrency.mrs',
        'path-in-bundle': 'geo/geosite/category-cryptocurrency.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/lige47/QuanX-icon-rule@main/icon/04ProxySoft/Bitcoin.png',
    rules: ['RULE-SET,cryptocurrency,GLOBAL'],
  },
  {
    name: 'EHentai',
    providers: {
      ehentai: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/ehentai.mrs',
        path: './ruleset/ehentai.mrs',
        'path-in-bundle': 'geo/geosite/ehentai.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/lige47/QuanX-icon-rule@main/icon/04ProxySoft/exhentai.png',
    rules: ['RULE-SET,ehentai,GLOBAL'],
  },
  {
    name: 'AdBlock',
    reject: true,
    providers: {
      adblockmihomolite: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/217heidai/adblockfilters@main/rules/adblockmihomolite.mrs',
        path: './ruleset/adblockmihomolite.mrs',
        'path-in-bundle': 'geo/geosite/category-ads-all.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Advertising.png',
    rules: ['RULE-SET,adblockmihomolite,AdBlock'],
  },
];

// ==================== FANZA：来自用户原脚本 ====================
const fanzaRuleProvider = {
  fanza: {
    type: 'http',
    format: 'yaml',
    interval: 86400,
    behavior: 'classical',
    url: 'https://raw.githubusercontent.com/Adagaki-Aki/my-website/main/FANZA2.yaml',
    path: './ruleset/Adagaki-Aki/FANZA2.yaml',
  },
};

serviceConfigs.push({
  name: 'FANZA',
  providers: fanzaRuleProvider,
  icon: 'https://fastly.jsdelivr.net/gh/Adagaki-Aki/my-website@main/FANZA_logo.svg.png',
  rules: ['RULE-SET,fanza,GLOBAL'],
  fanza: true,
});

// ==================== 节点处理 ====================
const regionMatchCache = new Map();

function getMatchedRegions(proxyName) {
  if (regionMatchCache.has(proxyName)) return regionMatchCache.get(proxyName);
  const regions = allRegionDefinitions.filter((region) => region.regex.test(proxyName));
  regionMatchCache.set(proxyName, regions);
  return regions;
}

const flagRegex = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
function normalizeProxyName(proxy) {
  const originalName = proxy.name;
  const flag = originalName.match(flagRegex)?.[0];
  const nameWithoutFlag = (flag ? originalName.replace(flag, '') : originalName).replace(/\s+/g, ' ').trim();
  const matchedRegions = getMatchedRegions(originalName);
  const regionFlag = flag || matchedRegions.find((region) => region.flag)?.flag;
  const normalizedName = regionFlag ? `${regionFlag} ${nameWithoutFlag}` : nameWithoutFlag;

  if (normalizedName !== originalName) regionMatchCache.set(normalizedName, matchedRegions);
  return normalizedName === originalName ? proxy : { ...proxy, name: normalizedName };
}

function fixDialerProxy(proxy, renameMap, normalizedProxyNames) {
  const target = proxy['dialer-proxy'];
  if (!target) return proxy;
  if (renameMap.has(target)) return { ...proxy, 'dialer-proxy': renameMap.get(target) };
  if (normalizedProxyNames.has(target)) return proxy;
  const copy = { ...proxy };
  delete copy['dialer-proxy'];
  return copy;
}

function getIpVersionPreference() {
  const ipv4PreferEnabled = ruleOptionsEnable.代理IPV4优先;
  const ipv6PreferEnabled = ruleOptionsEnable.代理IPV6优先;
  if (ipv4PreferEnabled && !ipv6PreferEnabled) return 'ipv4-prefer';
  if (ipv6PreferEnabled && !ipv4PreferEnabled) return 'ipv6-prefer';
  return null;
}

function filterAndNormalizeProxies(config) {
  regionMatchCache.clear();

  const lowRateRegex = ruleOptionsEnable.过滤低倍率节点
    ? rateRegionDefinitions.find((r) => r.name === lowRateRegionName)?.regex
    : null;
  const highRateRegex = ruleOptionsEnable.过滤高倍率节点
    ? rateRegionDefinitions.find((r) => r.name === highRateRegionName)?.regex
    : null;

  const originalProxies = Array.isArray(config.proxies) ? config.proxies : [];
  const filteredRawProxies = originalProxies.filter((proxy) => {
    const type = String(proxy.type ?? '').toLowerCase();
    if (type === 'direct' || type === 'reject' || type === 'rematch') return false;
    if (lowRateRegex?.test(proxy.name) || highRateRegex?.test(proxy.name)) return false;

    if (!ruleOptionsEnable.过滤非地区节点) return true;
    const isRegionProxy = getMatchedRegions(proxy.name).some((region) => regionDefinitions.includes(region));
    return isRegionProxy || !excludeFilter.test(proxy.name);
  });

  const renameMap = new Map();
  const normalizedProxies = [];
  const uniqueNames = new Set();

  for (const rawProxy of filteredRawProxies) {
    const normalized = normalizeProxyName(rawProxy);
    if (normalized.name !== rawProxy.name) renameMap.set(rawProxy.name, normalized.name);
    if (!uniqueNames.has(normalized.name)) {
      uniqueNames.add(normalized.name);
      normalizedProxies.push(normalized);
    }
  }

  const normalizedProxyNames = new Set(normalizedProxies.map((p) => p.name));
  const filteredProxies = normalizedProxies.map((proxy) => fixDialerProxy(proxy, renameMap, normalizedProxyNames));

  if (!filteredProxies.length && !hasProxyProviders(config)) {
    throw new Error('配置文件中未找到任何代理节点或 proxy-providers，请使用机场提供的配置文件进行覆写');
  }

  const ipVersionPreference = getIpVersionPreference();
  if (ipVersionPreference) {
    return filteredProxies.map((proxy) =>
      proxy['ip-version'] === ipVersionPreference ? proxy : { ...proxy, 'ip-version': ipVersionPreference },
    );
  }
  return filteredProxies;
}

// ==================== 自建节点 / 链式代理 ====================
function buildCustomizeGroups(filteredProxies, customizeList = customizeProxies) {
  const chainEnabled = ruleOptionsEnable.链式代理;
  if (!customizeList.length) {
    if (chainEnabled) throw new Error('启用失败，请在脚本中添加自定义节点后尝试');
    return { customProxies: [], customProxyNames: [], customGroup: null };
  }

  const usedNames = new Set(filteredProxies.map((p) => p.name));
  const customProxies = [];

  for (const proxy of customizeList) {
    const normalized = normalizeProxyName(proxy);
    let name = normalized.name;
    while (usedNames.has(name)) {
      name = normalizeProxyName({ name: `自建-${name}` }).name.replace('自建- ', '自建-');
    }
    usedNames.add(name);
    let customProxy = name === normalized.name ? normalized : { ...normalized, name };
    if (chainEnabled && customProxy['dialer-proxy'] !== dialerProxyName) {
      customProxy = { ...customProxy, 'dialer-proxy': dialerProxyName };
    }
    customProxies.push(customProxy);
  }

  const customProxyNames = customProxies.map((p) => p.name);
  const customGroup = {
    ...selectBaseOption,
    name: chainEnabled ? '链式落地' : '自建节点',
    proxies: customProxyNames,
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Server.png',
  };

  return { customProxies, customProxyNames, customGroup };
}

// ==================== DNS / Hosts ====================
const commonDnsList = [
  '223.5.5.5','223.6.6.6','119.29.29.29','1.12.12.12','120.53.53.53','114.114.114.114','180.76.76.76','1.2.4.8','116.116.116.116','101.226.4.6','123.125.81.6','180.184.1.1','180.184.2.2',
  '2400:3200::1','2400:3200:baba::1','2402:4e00::','2400:da00::6666',
  '1.1.1.1','1.0.0.1','8.8.8.8','8.8.4.4','9.9.9.9','149.112.112.112','208.67.222.222','208.67.220.220','94.140.14.14','94.140.15.15','76.76.2.0','76.76.10.0','185.228.168.9','185.228.169.9','77.88.8.8','77.88.8.1','156.154.70.1','156.154.71.1',
  '2606:4700:4700::1111','2606:4700:4700::1001','2001:4860:4860::8888','2001:4860:4860::8844','2620:fe::fe','2620:fe::9','2620:119:35::35','2620:119:53::53','2a10:50c0::bad1:ff','2a10:50c0::bad2:ff','2a10:50c0::ad1:ff','2a10:50c0::ad2:ff','2a0d:2a00:1::2','2a0d:2a00:2::2','2a02:6b8::feed:0ff','2a02:6b8:0:1::feed:0ff','2610:a1:1018::1','2610:a1:1019::53',
  'alidns','doh.pub','dot.pub','dns.pub','dnspod','dns.baidu','dns.google','dns.cloudflare','cloudflare-dns','quad9','opendns','nextdns','adguard',
];
const commonDnsRegex = new RegExp(commonDnsList.map((dns) => dns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
const chinaDNS = ['223.5.5.5#DIRECT', '119.29.29.29#DIRECT'];
const chinaDohDNS = ['https://223.5.5.5/dns-query#DIRECT', 'https://1.12.12.12/dns-query#DIRECT'];
const foreignDNS = ['https://cloudflare-dns.com/dns-query#节点选择', 'https://dns.google/dns-query#节点选择'];

function hostSpecificity(pattern) {
  if (pattern.startsWith('+.')) return 2;
  if (pattern.startsWith('.')) return 1;
  if (pattern.includes('*')) return 0;
  return 3;
}

function matchDomainPattern(pattern, domains) {
  pattern = pattern.toLowerCase();
  if (!pattern.includes('*') && !pattern.startsWith('+.') && !pattern.startsWith('.')) {
    return typeof domains === 'string'
      ? domains.toLowerCase() === pattern
      : [...domains].some((d) => d.toLowerCase() === pattern);
  }

  const domainList = typeof domains === 'string' ? [domains.toLowerCase()] : [...domains].map((d) => d.toLowerCase());
  if (pattern.startsWith('+.')) {
    const suffix = pattern.slice(2);
    return domainList.some((domain) => domain === suffix || domain.endsWith(`.${suffix}`));
  }
  if (pattern.startsWith('.')) {
    const suffix = pattern.slice(1);
    return domainList.some((domain) => domain !== suffix && domain.endsWith(`.${suffix}`));
  }

  const patternParts = pattern.split('.');
  return domainList.some((domain) => {
    const domainParts = domain.split('.');
    return patternParts.length === domainParts.length && patternParts.every((part, index) => part === '*' || part === domainParts[index]);
  });
}

function applyHostsToProxies(proxies, hosts) {
  if (!hosts || typeof hosts !== 'object') return proxies;

  const hostEntries = Object.entries(hosts)
    .filter(([, value]) => (typeof value === 'string' && value.length > 0) || (Array.isArray(value) && value.length > 0))
    .sort((a, b) => hostSpecificity(b[0]) - hostSpecificity(a[0]));
  if (!hostEntries.length) return proxies;

  const targetOf = (value) => {
    if (Array.isArray(value)) value = value.find((v) => typeof v === 'string' && v.length > 0);
    return typeof value === 'string' && value.length > 0 ? value : null;
  };

  const resolveCache = new Map();
  const resolve = (server) => {
    const cached = resolveCache.get(server);
    if (cached !== undefined) return cached;
    const seen = new Set();
    let current = server.toLowerCase();
    let result = server;

    while (!seen.has(current)) {
      seen.add(current);
      const entry = hostEntries.find(([pattern]) => matchDomainPattern(pattern, current));
      const target = entry && targetOf(entry[1]);
      if (!target) break;
      result = target;
      current = target.toLowerCase();
    }

    resolveCache.set(server, result);
    return result;
  };

  return proxies.map((proxy) => {
    if (typeof proxy.server !== 'string') return proxy;
    const server = resolve(proxy.server);
    return server === proxy.server ? proxy : { ...proxy, server };
  });
}

function stripDnsSuffix(dns) {
  const str = String(dns);
  const hashIndex = str.indexOf('#');
  if (hashIndex === -1) return str;
  const prefix = str.slice(0, hashIndex).trim();
  const suffix = str.slice(hashIndex + 1).toLowerCase().trim();
  if (suffix.includes('direct') || suffix.includes('直连')) return `${prefix}#DIRECT`;
  return prefix;
}

function isIpAddress(server) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(server) || server.includes(':');
}

function simplifyDomainPolicy(policy) {
  const groups = new Map();
  for (const [domain, dns] of Object.entries(policy)) {
    const dnsKey = JSON.stringify(Array.isArray(dns) ? [...dns].sort() : dns);
    if (domain.startsWith('+.') || domain.startsWith('.') || domain.includes('*')) {
      groups.set(`keep:${domain}`, [{ domain, dns, dnsKey }]);
      continue;
    }
    const parts = domain.split('.');
    if (parts.length < 3) {
      groups.set(`keep:${domain}`, [{ domain, dns, dnsKey }]);
      continue;
    }
    const suffix = parts.slice(-2).join('.');
    if (!groups.has(suffix)) groups.set(suffix, []);
    groups.get(suffix).push({ domain, dns, dnsKey });
  }

  const result = {};
  for (const [suffix, domains] of groups) {
    const firstDnsKey = domains[0].dnsKey;
    const sameDns = domains.every(({ dnsKey }) => dnsKey === firstDnsKey);
    if (domains.length >= 2 && sameDns) {
      result[`+.${suffix}`] = domains[0].dns;
    } else {
      for (const { domain, dns } of domains) result[domain] = dns;
    }
  }
  return result;
}

function buildDnsAndHostsConfig(config, filteredProxies) {
  const originalDnsConfig = config.dns || {};
  const proxyServerNameservers = originalDnsConfig['proxy-server-nameserver'] || [];
  const listenValue = originalDnsConfig['listen'];
  const shouldRewriteByHosts =
    proxyServerNameservers.length === 1 &&
    typeof listenValue === 'string' &&
    listenValue.length > 0 &&
    (proxyServerNameservers.some((dns) => String(dns).toLowerCase().includes(listenValue.toLowerCase())) ||
      (listenValue.includes('0.0.0.0') && proxyServerNameservers.some((dns) => String(dns).toLowerCase().includes('127.0.0.1'))));

  const mappedProxies = shouldRewriteByHosts ? applyHostsToProxies(filteredProxies, config.hosts) : filteredProxies;
  const proxyDomains = new Set(
    mappedProxies
      .filter((proxy) => typeof proxy.server === 'string')
      .map((proxy) => proxy.server.toLowerCase())
      .filter((server) => !isIpAddress(server)),
  );

  const privateProxyServerNameservers = shouldRewriteByHosts ? [] : proxyServerNameservers;

  const isCommonDns = (dns) => {
    const value = String(dns).trim().toLowerCase();
    if (value === 'system' || value === 'system://') return true;
    return commonDnsRegex.test(value);
  };

  const privateDNS = privateProxyServerNameservers.filter((dns) => !isCommonDns(dns));
  const originalProxyPolicy =
    originalDnsConfig['proxy-server-nameserver-policy'] && typeof originalDnsConfig['proxy-server-nameserver-policy'] === 'object'
      ? originalDnsConfig['proxy-server-nameserver-policy']
      : {};

  const matchedProxyPolicy = {};
  for (const [domain, dns] of Object.entries(originalProxyPolicy)) {
    if (!matchDomainPattern(domain, proxyDomains)) continue;
    const strippedDns = Array.isArray(dns) ? dns.map(stripDnsSuffix).filter(Boolean) : stripDnsSuffix(dns);
    if (Array.isArray(strippedDns) && strippedDns.length === 0) continue;
    matchedProxyPolicy[domain] = strippedDns;
  }

  if (privateDNS.length > 0 && Object.keys(matchedProxyPolicy).length === 0) {
    for (const domain of proxyDomains) matchedProxyPolicy[domain] = privateDNS;
  }

  const matchedPolicyDomains = Object.keys(matchedProxyPolicy);
  const proxyServerPolicy =
    proxyDomains.size === matchedPolicyDomains.length && matchedPolicyDomains.every((domain) => proxyDomains.has(domain.toLowerCase()))
      ? simplifyDomainPolicy(matchedProxyPolicy)
      : matchedProxyPolicy;

  const originalFakeIpFilter = originalDnsConfig['fake-ip-filter'] || [];
  const proxyFakeIpFilter = originalFakeIpFilter.filter((pattern) => matchDomainPattern(String(pattern), proxyDomains));

  const dns = {
    enable: true,
    ipv6: true,
    'use-hosts': true,
    'cache-algorithm': 'arc',
    'use-system-hosts': true,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/15',
    'fake-ip-range6': '2001:2::1/48',
    'fake-ip-filter': [
      'rule-set:private',
      'rule-set:fakeip_filter',
      'rule-set:geolocation-cn',
      ...(ruleOptionsEnable.FCM ? ['rule-set:googlefcm'] : []),
      ...proxyFakeIpFilter,
    ],
    'proxy-server-nameserver': chinaDohDNS,
    ...(Object.keys(proxyServerPolicy).length > 0 && { 'proxy-server-nameserver-policy': proxyServerPolicy }),
    'default-nameserver': chinaDohDNS,
    nameserver: foreignDNS,
    'nameserver-policy': { 'rule-set:cn': chinaDNS },
    'direct-nameserver': ['system', ...chinaDNS],
  };

  // MyClash 默认 Hosts + 机场原始 Hosts。
  // 机场原始 Hosts 放在后面，发生同名冲突时优先保留机场自己的定义。
  const myclashHosts = {
    'cloudflare-dns.com': ['1.1.1.1', '1.0.0.1'],
    'dns.google': ['8.8.8.8', '8.8.4.4'],
    'services.googleapis.cn': 'services.googleapis.com',
    '+.mcdn.bilivideo.com': ['0.0.0.0'],
    '+.mcdn.bilivideo.cn': ['0.0.0.0'],
    '+.edge.mountaintoys.cn': ['0.0.0.0'],
    '+.h2.smtcdns.net': ['0.0.0.0'],
  };

  const originalHosts =
    config.hosts && typeof config.hosts === 'object' && !Array.isArray(config.hosts)
      ? config.hosts
      : {};

  const hosts = { ...myclashHosts, ...originalHosts };

  return { dns, hosts, proxies: mappedProxies };
}

// ==================== 代理组构建 ====================
function buildFunctionalGroups(filteredProxies, customizeInfo, config) {
  const finalRuleProviders = { ...baseRuleProviders };
  if (!ruleOptionsEnable.屏蔽国外QUIC) delete finalRuleProviders.cn_additional;

  const { customProxyNames = [], customGroup = null } = customizeInfo || {};
  const filteredProxyNames = filteredProxies.map((p) => p.name);
  const allProxyNames = [...customProxyNames, ...filteredProxyNames];
  const proxyProviderNames = getProxyProviderNames(config);
  const hasProviders = proxyProviderNames.length > 0;

  // 唯一节点入口：本地节点显式展开；若存在 proxy-providers，则同时纳入 provider 节点。
  const groups = [{
    ...nodeSelectGroup,
    proxies: allProxyNames,
    ...(hasProviders && {
      'include-all-providers': true,
      'exclude-filter': excludeFilter.source,
    }),
  }];

  // 保留直连策略组，但它不属于节点分类组
  const directGroup = {
    ...selectBaseOption,
    name: '直连',
    proxies: directProxies.map((p) => p.name),
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/China.png',
  };

  const rules = [];
  const serviceGroupNames = [];

  const preferredServiceOrder = [
    'FANZA',
    'Steam',
    'AI',
    'EHentai',
    'FCM',
    'YouTube',
    'Google',
    'Microsoft',
    'Apple',
    'Telegram',
    'TikTok',
    'Twitter',
    'Instagram',
    'Netflix',
    'Emby',
    'PikPak',
    'Spotify',
    'Crypto',
    'AdBlock',
  ];

  const serviceConfigByName = new Map(serviceConfigs.map((svc) => [svc.name, svc]));
  const orderedServiceConfigs = preferredServiceOrder
    .map((name) => serviceConfigByName.get(name))
    .filter(Boolean);

  for (const svc of orderedServiceConfigs) {
    if (!ruleOptionsEnable[svc.name]) continue;

    rules.push(...(svc.rules || []));

    // Steam 必须优先于 games_cn。否则 games_cn 中的 steamserver.net 等规则
    // 会提前命中直连，导致 Steam 策略组（如香港/日本节点）失效。
    if (svc.name === 'Steam') {
      rules.push('RULE-SET,games_cn,直连');
    }

    Object.assign(finalRuleProviders, svc.providers || {});

    if (svc.reject) {
      groups.push({
        ...selectBaseOption,
        name: svc.name,
        icon: svc.icon,
        proxies: ['REJECT', 'REJECT-DROP', 'PASS'],
      });
      serviceGroupNames.push(svc.name);
      continue;
    }

    if (svc.fanza) {
      const japaneseNodes = filteredProxies
        .filter((proxy) => getMatchedRegions(proxy.name).some((region) => region.name === '日本'))
        .map((proxy) => proxy.name);
      groups.push({
        ...selectBaseOption,
        name: svc.name,
        icon: svc.icon,
        proxies: [...new Set(['节点选择', ...japaneseNodes])],
        ...(hasProviders && {
          'include-all-providers': true,
          filter: '日本|jp|japan|🇯🇵',
          'exclude-filter': excludeFilter.source,
        }),
      });
      serviceGroupNames.push(svc.name);
      continue;
    }

    // 普通分流组：手动选择具体节点；存在 provider 时同时纳入 provider 节点。
    const serviceProxies = svc.direct
      ? ['节点选择', '直连', ...allProxyNames]
      : ['节点选择', ...allProxyNames];

    groups.push({
      ...selectBaseOption,
      name: svc.name,
      icon: svc.icon,
      proxies: [...new Set(serviceProxies)],
      ...(hasProviders && {
        'include-all-providers': true,
        'exclude-filter': excludeFilter.source,
      }),
      ...(svc.defaultSelected === '直连' && { 'default-selected': '直连' }),
    });
    serviceGroupNames.push(svc.name);
  }

  if (!ruleOptionsEnable.节点选择) {
    throw new Error('「节点选择」必须启用，否则服务分流组将失去唯一代理入口');
  }

  const chainGroup =
    ruleOptionsEnable.链式代理 && customGroup
      ? {
          ...selectBaseOption,
          name: dialerProxyName,
          proxies: filteredProxyNames,
          icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Bypass.png',
        }
      : null;

  if (customGroup) groups.push(customGroup);
  if (chainGroup) groups.push(chainGroup);
  groups.push(directGroup);

  // Bettbox 实验版：GLOBAL 本身只保留「节点选择 / 直连」。
  // 业务分流组仍然生成，以便在规则界面保留策略组定义；实际规则统一指向 GLOBAL。
  const globalGroup = {
    ...selectBaseOption,
    name: 'GLOBAL',
    proxies: [
      '节点选择',
      '直连',
    ],
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Global.png',
  };

  groups.push(globalGroup);
  groups.push({
    ...selectBaseOption,
    name: '漏网之鱼',
    proxies: ['节点选择', '直连'],
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Stack.png',
  });

  return {
    globalGroup,
    functionalGroups: groups,
    functionalRules: rules,
    finalRuleProviders,
    chainGroup,
    directGroup,
  };
}

// ==================== 主入口 ====================
function buildConfig(config, inheritOriginalConfig) {
  // 继承版：保留机场所有未被脚本明确接管的顶层字段。
  // 非继承版：只输出脚本明确管理的字段；但 proxy-providers 是节点来源的必要入口，因此若存在则保留。
  const newConfig = inheritOriginalConfig ? { ...config } : {};

  const filteredProxies = filterAndNormalizeProxies(config);
  const customizeInfo = buildCustomizeGroups(filteredProxies);
  const { customProxies } = customizeInfo;

  const { functionalGroups, functionalRules, finalRuleProviders } = buildFunctionalGroups(
    filteredProxies,
    customizeInfo,
    config,
  );

  const { dns, hosts, proxies: mappedProxies } = buildDnsAndHostsConfig(config, filteredProxies);

  newConfig.dns = dns;
  newConfig.hosts = hosts;
  newConfig['mixed-port'] = 7890;
  newConfig['allow-lan'] = false;
  newConfig.ipv6 = false;
  newConfig.mode = 'rule';
  newConfig['log-level'] = 'info';
  newConfig['bind-address'] = '127.0.0.1';
  newConfig['unified-delay'] = true;
  newConfig['tcp-concurrent'] = true;
  newConfig['keep-alive-interval'] = 60;
  newConfig['find-process-mode'] = 'strict';
  newConfig['external-controller'] = '127.0.0.1:9090';
  newConfig['external-ui'] = 'ui';
  newConfig['external-ui-url'] = 'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip';

  newConfig.profile = {
    ...(inheritOriginalConfig && config.profile && typeof config.profile === 'object' ? config.profile : {}),
    'store-selected': true,
    'store-fake-ip': true,
  };

  // 你的实际使用方式不依赖 Mihomo NTP。
  newConfig.ntp = { enable: false };

  // 你的实际使用方式不依赖 TUN；不再保留无效的 TUN 子参数。
  newConfig.tun = { enable: false };

  newConfig.proxies = [...customProxies, ...mappedProxies, ...directProxies];
  newConfig['proxy-groups'] = functionalGroups;
  newConfig['rule-providers'] = finalRuleProviders;

  // 非继承版仍保留 proxy-providers，否则 provider 型机场会直接丢失其节点来源。
  if (!inheritOriginalConfig && hasProxyProviders(config)) {
    newConfig['proxy-providers'] = config['proxy-providers'];
  }

  newConfig.rules = [
    ...prefixRules,
    ...(ruleOptionsEnable.屏蔽国外QUIC ? blockForeignQuic : []),
    ...functionalRules,
    'RULE-SET,geolocation-!cn,GLOBAL',
    'RULE-SET,cn_ip,GLOBAL',
    'RULE-SET,private_ip,GLOBAL',
    'MATCH,GLOBAL',
  ];

  return newConfig;
}

// 默认入口：继承机场原配置。
function main(config) {
  return buildConfig(config, true);
}

// 非继承版入口：若你的运行环境支持指定入口，可使用此函数。
function mainWithoutInheritance(config) {
  return buildConfig(config, false);
}
