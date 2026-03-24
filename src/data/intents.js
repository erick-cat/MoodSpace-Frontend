export const INTENT_DATA = {
    confession: {
        title: "有些话，说出口不容易",
        subtitle: "你更接近哪一种情况？",
        categoryLabel: "心动告白",
        icon: "auto_awesome",
        options: [
            { text: "想对TA说点什么，但不知道怎么开口", helper: "那我们可以慢慢把它写下来" },
            { text: "有些暗恋，不想继续藏着了", helper: "勇敢一点，给故事一个开始" },
            { text: "只是想告诉TA，今天也很喜欢你", helper: "平淡日常里的直白心意" }
        ],
        templates: [
            { id: 'starry_confession', name: '星空告白', icon: 'auto_awesome', desc: '在漫天星辰的见证下，诉说最真挚的心意。', color: 'primary' },
            { id: 'love_letter', name: '情书时代', icon: 'favorite', desc: '干净纯粹的纸质书信风，字字句句皆是情深。', color: 'secondary' },
            { id: 'neon_heart', name: '霓虹心跳', icon: 'monitor_heart', desc: '轻快明亮的赛博氛围，直白表达心底的悸动。', color: 'tertiary' }
        ]
    },
    apology: {
        title: "想和好，却不知打破僵局",
        subtitle: "这封信，希望是和解的开始。",
        categoryLabel: "关系修复",
        icon: "favorite",
        options: [
            { text: "对不起，那天是我态度不好", helper: "退一步，让关系重新呼吸" },
            { text: "其实我还在乎你，不想冷战了", helper: "坦诚脆弱也是一种勇敢" },
            { text: "惹你生气了，这该怎么办才好", helper: "低头不代表认输，代表珍惜" }
        ],
        templates: [
            { id: 'rainy_apology', name: '雨夜低语', icon: 'water_drop', desc: '滴答的雨声中，藏着最诚恳的歉意。', color: 'primary' },
            { id: 'warm_light', name: '微光倾听', icon: 'wb_incandescent', desc: '像一盏深夜的暖光灯，等待关系重新回暖。', color: 'secondary' },
            { id: 'broken_glass', name: '时光拼图', icon: 'extension', desc: '把破碎的情绪慢慢拾起，重新拼凑完整。', color: 'tertiary' }
        ]
    },
    anniversary: {
        title: "每一个日子，都值得铭记",
        subtitle: "回首一起走过的路...",
        categoryLabel: "专属纪念日",
        icon: "celebration",
        options: [
            { text: "这是我们在一起的第N天", helper: "时间是最好的见证者" },
            { text: "祝你生日快乐，我的唯一", helper: "把最好的祝福打包送给你" },
            { text: "关于我们的专属纪念日", helper: "那些细微的日常，全都是浪漫" }
        ],
        templates: [
            { id: 'golden_memories', name: '流金岁月', icon: 'hourglass_empty', desc: '用闪耀温暖的倒计时，记录你们共同的时间。', color: 'primary' },
            { id: 'celebration_fireworks', name: '花火灿烂', icon: 'celebration', desc: '浪漫绚烂的烟火特效，点燃这个重要的日子。', color: 'secondary' },
            { id: 'polaroid_wall', name: '拍立得影集', icon: 'photo_library', desc: '一张张滑过的相片，串联起所有的甜蜜瞬间。', color: 'tertiary' }
        ]
    },
    memory: {
        title: "时光太浅，回忆太深",
        subtitle: "你想留下哪些珍贵的瞬间？",
        categoryLabel: "时光回忆志",
        icon: "history",
        options: [
            { text: "只是一次平凡却难忘的约会", helper: "因为是你，所以特别" },
            { text: "一起去过的地方，看过的风景", helper: "照片会褪色，但记忆不会" },
            { text: "关于我们的“第一次”合集", helper: "第一次牵手，第一次旅行..." }
        ],
        templates: [
            { id: 'vintage_film', name: '复古胶卷', icon: 'movie', desc: '老电影般的放映效果，让记忆隽永留存。', color: 'primary' },
            { id: 'breeze_diary', name: '微风手账', icon: 'menu_book', desc: '清新自然的手账记录风格，留住那一天的阳光。', color: 'secondary' },
            { id: 'constellation_map', name: '星轨连线', icon: 'share', desc: '每一个回忆都是一颗星，连成专属你们的星座。', color: 'tertiary' }
        ]
    },
    diary: {
        title: "今天的心情，是什么颜色？",
        subtitle: "随便写写，反正只有空间懂你。",
        categoryLabel: "情绪碎碎念",
        icon: "psychology",
        options: [
            { text: "今天有点累，但还是想记录下", helper: "给自己一个拥抱" },
            { text: "遇到了一件很开心的小事", helper: "让快乐的保质期更长一点" },
            { text: "此刻有点想念某个人", helper: "思念是一种无声的回音" }
        ],
        templates: [
            { id: 'minimal_white', name: '极简白纸', icon: 'check_box_outline_blank', desc: '没有任何打扰，只留下最纯粹的黑白文字。', color: 'primary' },
            { id: 'lofi_room', name: 'Lofi 房间', icon: 'headphones', desc: '伴随白噪音与暗光，享受独处的倾诉感。', color: 'secondary' },
            { id: 'sunset_glow', name: '落日余晖', icon: 'wb_twilight', desc: '像黄昏时的云彩一样，温柔包裹所有的思绪。', color: 'tertiary' }
        ]
    }
};
