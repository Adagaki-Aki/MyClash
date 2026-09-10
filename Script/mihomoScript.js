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
 * 7. 自建版采用简化 DNS：保留 MyClash 的国内/国外 DNS 分流与 fake-ip，但删除私有 DNS / Hosts -> proxy.server 逻辑
 * 8. 保留 MyClash 的国内外规则、国外 QUIC 拦截及服务 Rule Providers
 * 9. 适用于公网 IP 直连的 VLESS Reality / Hysteria2 / SOCKS5 等自建节点；不接管机场 proxy-providers
 *
 * 重要：本版不创建 url-test / load-balance，不做自动测速，不做自动故障转移。
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
  { name: '🇨🇳 直连', type: 'direct' },
  { name: '🇨🇳 直连 | 仅IPv4', type: 'direct', 'ip-version': 'ipv4' },
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
    rules: ['RULE-SET,googlefcm,FCM'],
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
    rules: ['RULE-SET,youtube,YouTube'],
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
    rules: ['RULE-SET,google,Google', 'RULE-SET,google_ip,Google,no-resolve'],
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
    rules: ['RULE-SET,ai,AI'],
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
    rules: ['RULE-SET,github,节点选择', 'RULE-SET,microsoft,Microsoft'],
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
    rules: ['RULE-SET,apple,Apple'],
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
    rules: ['RULE-SET,telegram,Telegram', 'RULE-SET,telegram_ip,Telegram,no-resolve'],
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
    rules: ['RULE-SET,steam,Steam', 'RULE-SET,steam_ip,Steam,no-resolve'],
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
    rules: ['RULE-SET,tiktok,TikTok', 'RULE-SET,tiktok_ip,TikTok,no-resolve'],
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
    rules: ['RULE-SET,twitter,Twitter', 'RULE-SET,twitter_ip,Twitter,no-resolve'],
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
    rules: ['RULE-SET,instagram,Instagram'],
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
    rules: ['RULE-SET,netflix,Netflix', 'RULE-SET,netflix_ip,Netflix,no-resolve'],
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
      'RULE-SET,emby,Emby',
      'RULE-SET,emos,Emby',
      'DOMAIN-SUFFIX,mb3admin.com,Emby',
      'DOMAIN-SUFFIX,nubebelle.com,Emby',
      'DOMAIN-KEYWORD,emby,Emby',
      'PROCESS-NAME,com.mb.android,Emby',
      'PROCESS-NAME,tv.emby.embyatv,Emby',
      'PROCESS-NAME,com.hush.yamby,Emby',
      'PROCESS-NAME,com.jellycine.app,Emby',
      'PROCESS-NAME,com.mountains.hills,Emby',
      'PROCESS-NAME,RodelPlayer.App.exe,Emby',
      'PROCESS-NAME,com.feifeiduck.capyplayer,Emby',
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
    rules: ['RULE-SET,pikpak,PikPak'],
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
    rules: ['RULE-SET,spotify,Spotify', 'RULE-SET,spotify_ip,Spotify,no-resolve'],
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
    rules: ['RULE-SET,cryptocurrency,Crypto'],
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
    rules: ['RULE-SET,ehentai,EHentai'],
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
  rules: ['RULE-SET,fanza,FANZA'],
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

  if (!filteredProxies.length) {
    throw new Error('配置文件中未找到任何代理节点，请使用机场提供的配置文件进行覆写');
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

// ==================== DNS / Hosts（自建节点专用） ====================
// 自建版说明：
// 1. 自建节点的 server 均为公网 IP，不依赖机场私有 DNS。
// 2. 不读取/继承机场 proxy-server-nameserver。
// 3. 不执行 Hosts -> proxy.server 改写。
// 4. 不合并机场 hosts，避免把不存在的机场 DNS/Hosts 逻辑带入自建配置。
// 5. 保留 MyClash 的国内/国外分流 DNS 思路。
// 6. 节点本身直接连接 IP，因此不需要 proxy-server-nameserver。

const chinaDNS = ['223.5.5.5#DIRECT', '119.29.29.29#DIRECT'];
const chinaDohDNS = [
  'https://223.5.5.5/dns-query#DIRECT',
  'https://1.12.12.12/dns-query#DIRECT',
];
const foreignDNS = [
  'https://cloudflare-dns.com/dns-query#节点选择',
  'https://dns.google/dns-query#节点选择',
];

function buildDnsAndHostsConfig(config, filteredProxies) {
  // 自建节点全部使用公网 IP 作为 server，不需要私有 DNS / Hosts 映射。
  // 代理节点自身无需 proxy-server-nameserver。
  const dns = {
    enable: true,
    ipv6: false,
    'use-hosts': true,
    'use-system-hosts': true,
    'cache-algorithm': 'arc',
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/15',
    'fake-ip-filter': [
      'rule-set:private',
      'rule-set:fakeip_filter',
      'rule-set:geolocation-cn',
      ...(ruleOptionsEnable.FCM ? ['rule-set:googlefcm'] : []),
    ],
    'default-nameserver': chinaDohDNS,
    nameserver: foreignDNS,
    'nameserver-policy': {
      'rule-set:cn': chinaDNS,
    },
    'direct-nameserver': chinaDNS,
  };

  // 自建版不需要机场 Hosts，也不做 Hosts -> proxy.server 改写。
  // 节点 server 全部是公网 IP，因此最终配置不注入任何自定义 Hosts。
  // use-system-hosts 仍然保留，避免影响系统本身的本地 hosts 使用。
  const hosts = {};

  return { dns, hosts, proxies: filteredProxies };
}

// ==================== 代理组构建 ====================
function buildFunctionalGroups(filteredProxies, customizeInfo) {
  const finalRuleProviders = { ...baseRuleProviders };
  if (!ruleOptionsEnable.屏蔽国外QUIC) delete finalRuleProviders.cn_additional;

  const { customProxyNames = [], customGroup = null } = customizeInfo || {};
  const filteredProxyNames = filteredProxies.map((p) => p.name);
  const allProxyNames = [...customProxyNames, ...filteredProxyNames];

  // 唯一节点入口：只暴露节点本身，不套自动选择 / 地区组 / 倍率组
  const groups = [{
    ...nodeSelectGroup,
    proxies: allProxyNames,
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

  // 代理组排序：先放用户指定的核心组，再按 MyClash 服务分流顺序生成。
  // 其中 FANZA / Steam / AI / EHentai 固定置于前面；其余服务按开关配置中的定义顺序。
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

  // MyClash 的服务组按开关决定是否生成。普通服务仅引用「节点选择」，direct=true 的服务继续保留 MyClash 的「直连」能力。
  for (const svc of orderedServiceConfigs) {
    if (!ruleOptionsEnable[svc.name]) continue;

    rules.push(...(svc.rules || []));
    Object.assign(finalRuleProviders, svc.providers || {});

    // Steam 必须先于 games_cn，避免 steamserver.net 等下载服务器
    // 被 games_cn 提前判定为直连。
    if (svc.name === 'Steam') {
      rules.push('RULE-SET,games_cn,直连');
      if (finalRuleProviders.games_cn) {
        // games_cn 已由 baseRuleProviders 提供，无需重复加入 provider。
      }
    }

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
      });
      serviceGroupNames.push(svc.name);
      continue;
    }

    // 普通分流组：保留「节点选择」作为总入口，同时把全部节点直接展开，
    // 这样进入 YouTube / Google / AI / Steam 等组时，可以直接手动选择具体节点。
    const serviceProxies = svc.direct
      ? ['节点选择', '直连', ...allProxyNames]
      : ['节点选择', ...allProxyNames];

    groups.push({
      ...selectBaseOption,
      name: svc.name,
      icon: svc.icon,
      proxies: [...new Set(serviceProxies)],
      ...(svc.defaultSelected === '直连' && { 'default-selected': '直连' }),
    });
    serviceGroupNames.push(svc.name);
  }

  // 防止关闭节点选择开关后出现悬空引用；正常情况下该开关建议保持 true。
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

  // GLOBAL 模式只显示全部实际节点和直连，不显示服务分流组。
  // 切换到「全局」后，可直接选择任意节点或直连。
  const globalGroup = {
    ...selectBaseOption,
    name: 'GLOBAL',
    proxies: [
      ...allProxyNames,
      ...(chainGroup ? [chainGroup.name] : []),
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
function main(config) {
  const newConfig = {};

  const filteredProxies = filterAndNormalizeProxies(config);
  const customizeInfo = buildCustomizeGroups(filteredProxies);
  const { customProxies, customGroup } = customizeInfo;

  const { globalGroup, functionalGroups, functionalRules, finalRuleProviders } = buildFunctionalGroups(
    filteredProxies,
    customizeInfo,
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
    'store-selected': true,
    'store-fake-ip': true,
  };

  newConfig.ntp = {
    enable: false,
  };

  newConfig.tun = {
    enable: false,
  };

  newConfig.proxies = [...customProxies, ...mappedProxies, ...directProxies];
  newConfig['proxy-groups'] = functionalGroups;
  newConfig['rule-providers'] = finalRuleProviders;

  newConfig.rules = [
    ...prefixRules,
    ...(ruleOptionsEnable.屏蔽国外QUIC ? blockForeignQuic : []),
    ...functionalRules,
    // MyClash 原「默认代理」已取消，漏网的国外流量统一进入唯一节点入口。
    'RULE-SET,geolocation-!cn,节点选择',
    'RULE-SET,cn_ip,直连',
    'RULE-SET,private_ip,直连',
    'MATCH,漏网之鱼',
  ];

  return newConfig;
}
