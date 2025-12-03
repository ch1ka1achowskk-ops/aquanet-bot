require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const bodyParser = require('body-parser');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const SITE_URL = 'https://aquanet-bot-anfn.onrender.com/'; 
const ADMIN_PASSWORD = "admin";

let globalDeficit = 20; 

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'aquanet.db'))

const TRANSLATIONS = {
    ru: {
        welcome: "Добро пожаловать в AquaNet! 💧\nПожалуйста, выберите язык:",
        menu_queue: "💧 Моя очередь",
        menu_reg: "📝 Регистрация / Изм.",
        menu_report: "⚠️ Воды мало!",
        menu_weather: "☁️ Погода",
        menu_site: "🌐 Открыть сайт",
        reg_step1: "1-шаг: Выберите область:",
        reg_step2: "2-шаг: Выберите район:",
        reg_step3: "3-шаг: Напишите название села (вручную):",
        reg_step4: "4-шаг: Что вы выращиваете?",
        reg_step5: "5-шаг: Укажите площадь (гектары, например: 2.5):",
        saved: "✅ Вы успешно зарегистрированы!\nТеперь вы можете следить за очередью.",
        not_reg: "Вы еще не зарегистрированы. Нажмите '📝 Регистрация'.",
        queue_header: "Очередь по селу",
        deficit: "Дефицит",
        time: "Ваше время",
        report_sent: "✅ Сигнал отправлен администратору и соседям.",
        weather_info: "Текущий дефицит воды",
        site_link: "🔗 Вот ссылка на общую таблицу очередей:",
        error_num: "Пожалуйста, введите число (например 1.5).",
        choose_list: "Выберите из списка.",
        sos_confirm: "Подтвердите, что воды действительно мало:",
        yes: "Да, подтверждаю",
        no: "Отмена"
    },
    ky: {
        welcome: "AquaNet'ке кош келиңиз! 💧\nСураныч, тилди тандаңыз:",
        menu_queue: "💧 Менин кезегим",
        menu_reg: "📝 Катталуу / Өзгөртүү",
        menu_report: "⚠️ Суу аз!",
        menu_weather: "☁️ Аба ырайы",
        menu_site: "🌐 Сайтты ачуу", 
        reg_step1: "1-кадам: Облусту тандаңыз:",
        reg_step2: "2-кадам: Районду тандаңыз:",
        reg_step3: "3-кадам: Айылдын атын жазыңыз (кол менен):",
        reg_step4: "4-кадам: Эмне айдайсыз?",
        reg_step5: "5-кадам: Жериңиздин аянты канча (гектар, мисалы: 2.5)?",
        saved: "✅ Сиз ийгиликтүү катталдыңыз!\nЭми кезекти көзөмөлдөй аласыз.",
        not_reg: "Сиз каттала элексиз. '📝 Катталуу' баскычын басыңыз.",
        queue_header: "Айыл боюнча кезек",
        deficit: "Тартыштык",
        time: "Сиздин убакыт",
        report_sent: "✅ Админге жана кошуналарга кабар берилди.",
        weather_info: "Учурдагы суу таңсыктыгы",
        site_link: "🔗 Жалпы кезекти көрүү үчүн сайтка кириңиз:",
        error_num: "Сураныч, сан жазыңыз (мисалы 1.5).",
        choose_list: "Тизмеден тандаңыз.",
        sos_confirm: "Суу чын эле азбы? Тастыктаңыз:",
        yes: "Ооба, кабарлоо",
        no: "Жок, артка"
    }
};

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {

    db.all("SELECT * FROM farmers ORDER BY area DESC", (err, rows) => {
        const villages = {};
        rows.forEach(row => {
            if (!villages[row.village]) villages[row.village] = [];
           let cropMultiplier = 500;
        if (row.crop) {
            const cropKey = row.crop.split(' ')[0];
            const cleanCropKey = row.crop.split(' ')[1] || row.crop.split(' ')[0];
            cropMultiplier = CROP_COEFFS[cleanCropKey] || 500;
        }
        
        let demand = (row.area || 0) * cropMultiplier
            let duration = Math.floor((demand / 10) * (1 - globalDeficit/100));
            row.duration = duration;
            villages[row.village].push(row);
        });
        res.render('index', { villages, deficit: globalDeficit });
    });
});

// Главная админ-страница
app.get('/admin', (req, res) => {
    const { name, oblast, rayon, village, crop } = req.query;
    const filters = { name, oblast, rayon, village, crop };

    let sql = "SELECT * FROM farmers";
    const where = [];
    const params = [];

    if (name) {
        where.push("name LIKE ?");
        params.push('%' + name + '%');
    }
    if (oblast) {
        where.push("oblast = ?");
        params.push(oblast);
    }
    if (rayon) {
        where.push("rayon = ?");
        params.push(rayon);
    }
    if (village) {
        where.push("village LIKE ?");
        params.push('%' + village + '%');
    }
    if (crop) {
        where.push("crop = ?");
        params.push(crop);
    }

    if (where.length) {
        sql += " WHERE " + where.join(" AND ");
    }
    sql += " ORDER BY village ASC, area DESC";

    db.all(sql, params, (err, rows) => {
        if (err) return res.send("DB error");

        rows.forEach(row => {
            let cropMultiplier = 500;
            if (row.crop) {
                const cleanCropKey = row.crop.split(' ')[1] || row.crop.split(' ')[0];
                cropMultiplier = CROP_COEFFS[cleanCropKey] || 500;
            }
            const demand = (row.area || 0) * cropMultiplier;
            row.duration = Math.floor((demand / 10) * (1 - globalDeficit / 100));
        });

        const allRayons = Array.from(new Set(Object.values(GEOGRAPHY).flat()));

        res.render('admin', {
            filters,
            farmers: rows,
            GEOGRAPHY,
            CROP_COEFFS,
            allRayons,
            deficit: globalDeficit
        });
    });
});

// Аналитика
app.get('/admin/analytics', (req, res) => {
    db.all("SELECT oblast, COUNT(*) AS count, SUM(area) AS area FROM farmers GROUP BY oblast", (err, byOblast) => {
        if (err) return res.send("DB error");
        db.all("SELECT crop, COUNT(*) AS count, SUM(area) AS area FROM farmers GROUP BY crop", (err2, byCrop) => {
            if (err2) return res.send("DB error");
            db.get("SELECT COUNT(*) AS count, SUM(area) AS area FROM farmers", (err3, totalRow) => {
                const totalFarmers = totalRow?.count || 0;
                const totalArea = totalRow?.area || 0;

                res.render('analytics', {
                    byOblast: byOblast || [],
                    byCrop: byCrop || [],
                    totalFarmers,
                    totalArea,
                    deficit: globalDeficit
                });
            });
        });
    });
});

app.post('/admin/set-deficit', (req, res) => {
    globalDeficit = parseInt(req.body.deficit) || 0;
    res.redirect('/admin');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS farmers (
    user_id INTEGER PRIMARY KEY,
    name TEXT,
    oblast TEXT,
    rayon TEXT,
    village TEXT,
    area REAL,
    crop TEXT,
    lang TEXT DEFAULT 'ru'
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, message TEXT, timestamp DATETIME)`);
});

const GEOGRAPHY = {
  '📍 Баткен обл.': ['Баткен р-н', 'Кадамжай р-н', 'Лейлек р-н'],
  '📍 Ош обл.': ['Кара-Суу р-н', 'Ноокат р-н', 'Өзгөн р-н', 'Алай р-н'],
  '📍 Чүй обл.': ['Аламүдүн р-н', 'Сокулук р-н', 'Москва р-н'],
  '📍 Ысык-Көл обл.': ['Ысык-Көл р-н', 'Жети-Өгүз р-н', 'Балыкчы ш.'], 
  '📍 Жалал-Абад обл.': ['Сузак р-н', 'Базар-Коргон р-н']
};

const CROP_COEFFS = {
  '🌾 Буудай': 500, '🍎 Алма': 800, '🌽 Жүгөрү': 600, '🥔 Картошка': 400
};

const userState = {}; 
function getTxt(lang, key) {
    return TRANSLATIONS[lang || 'ru'][key] || TRANSLATIONS['ru'][key];
}

bot.start((ctx) => {
    ctx.reply("🇷🇺 Выберите язык / 🇰🇬 Тилди тандаңыз:", 
        Markup.inlineKeyboard([
            Markup.button.callback("🇷🇺 Русский", "set_lang_ru"),
            Markup.button.callback("🇰🇬 Кыргызча", "set_lang_ky")
        ])
    );
});
bot.action(/set_lang_(.+)/, (ctx) => {
    const lang = ctx.match[1]; 
    const userId = ctx.from.id;
    const name = ctx.from.first_name;
    db.run(`INSERT OR REPLACE INTO farmers (user_id, name, lang) VALUES (?, ?, COALESCE((SELECT lang FROM farmers WHERE user_id=?), ?))`, 
    [userId, name, userId, lang], (err) => {
        db.run(`UPDATE farmers SET lang = ? WHERE user_id = ?`, [lang, userId]);
        
        showMainMenu(ctx, lang);
    });
});

function showMainMenu(ctx, lang) {
    const txt = TRANSLATIONS[lang];
    const keyboard = Markup.keyboard([
        [txt.menu_queue, txt.menu_reg],
        [txt.menu_report, txt.menu_weather],
        [txt.menu_site] 
    ]).resize();
    
    ctx.reply(lang === 'ru' ? "Меню:" : "Меню:", keyboard);
}

const withUserLang = (ctx, callback) => {
    const userId = ctx.from.id;
    db.get("SELECT lang FROM farmers WHERE user_id = ?", [userId], (err, row) => {
        const lang = row ? row.lang : 'ru';
        callback(lang);
    });
};

bot.hears(['📝 Регистрация / Изм.', '📝 Катталуу / Өзгөртүү'], (ctx) => {
    withUserLang(ctx, (lang) => {
        userState[ctx.from.id] = { step: 'OBLAST', lang: lang };
        ctx.reply(getTxt(lang, 'reg_step1'), Markup.keyboard(Object.keys(GEOGRAPHY).map(d => [d])).oneTime().resize());
    });
});

bot.hears(['🌐 Открыть сайт', '🌐 Сайтты ачуу'], (ctx) => {
    withUserLang(ctx, (lang) => {
        ctx.reply(`${getTxt(lang, 'site_link')}\n\n👉 ${SITE_URL}`);
    });
});

bot.on('text', (ctx, next) => {
    const userId = ctx.from.id;
    const state = userState[userId];
    const text = ctx.message.text;

    if (!state) return next(); 

    const lang = state.lang;
    const txt = TRANSLATIONS[lang];

    if (state.step === 'OBLAST') {
        if (!GEOGRAPHY[text]) return ctx.reply(txt.choose_list);
        state.oblast = text;
        state.step = 'RAYON';
        return ctx.reply(txt.reg_step2, Markup.keyboard(GEOGRAPHY[text].map(r => [r])).oneTime().resize());
    }
    if (state.step === 'RAYON') {
         state.rayon = text; state.step = 'VILLAGE';
         return ctx.reply(txt.reg_step3, Markup.removeKeyboard());
    }
    if (state.step === 'VILLAGE') {
        state.village = text; state.step = 'CROP';
        return ctx.reply(txt.reg_step4, Markup.keyboard(Object.keys(CROP_COEFFS).map(c=>[c])).oneTime().resize());
    }
    if (state.step === 'CROP') {
        state.crop = text; state.step = 'AREA';
        return ctx.reply(txt.reg_step5);
    }
    if (state.step === 'AREA') {
        const area = parseFloat(text.replace(',', '.'));
        if(isNaN(area)) return ctx.reply(txt.error_num);
        
        db.run(`UPDATE farmers SET oblast=?, rayon=?, village=?, area=?, crop=? WHERE user_id=?`,
        [state.oblast, state.rayon, state.village, area, state.crop, userId], 
        () => {
            delete userState[userId];
            ctx.reply(`${txt.saved}\n\n${txt.site_link} ${SITE_URL}`);
            showMainMenu(ctx, lang);
        });
    }
});

// ---------------------------------------------------------------
//    💧 М О Я   О Ч Е Р Е Д Ь   (сделано РАНДОМНО)
// ---------------------------------------------------------------
bot.hears(['💧 Моя очередь', '💧 Менин кезегим'], (ctx) => {
    withUserLang(ctx, (lang) => {
        const txt = TRANSLATIONS[lang];
        db.get('SELECT * FROM farmers WHERE user_id = ?', [ctx.from.id], (err, farmer) => {
            if (!farmer || !farmer.village) return ctx.reply(txt.not_reg);
            
            // 🔥 RANDOM время для самого пользователя
            const durationFarmer = Math.floor(Math.random() * 30) + 5; // RANDOM

            db.all('SELECT * FROM farmers WHERE village = ? ORDER BY area DESC', [farmer.village], (err, neighbors) => {
                let msg = `🏡 *${txt.queue_header}: ${farmer.village}*\n📉 ${txt.deficit}: ${globalDeficit}%\n${txt.time}: ${durationFarmer} мин.\n\n`;
                
                neighbors.forEach((n, i) => {
                    // 🔥 RANDOM время для каждого соседа
                    const duration = Math.floor(Math.random() * 30) + 5; // RANDOM
                    msg += `в ${i+1}. ${n.name} (${n.crop}) - ${duration} .\n`;
                });

                msg += `\n👉 ${SITE_URL}`; 
                ctx.replyWithMarkdown(msg);
            });
        });
    });
});

// SOS
bot.hears(['⚠️ Воды мало!', '⚠️ Суу аз!'], (ctx) => {
    withUserLang(ctx, (lang) => {
        ctx.reply(getTxt(lang, 'sos_confirm'), Markup.inlineKeyboard([
            Markup.button.callback(getTxt(lang, 'yes'), 'confirm_sos'),
            Markup.button.callback(getTxt(lang, 'no'), 'cancel_sos')
        ]));
    });
});

bot.action('confirm_sos', (ctx) => {
    withUserLang(ctx, (lang) => {
        db.run('INSERT INTO reports (user_id, message, timestamp) VALUES (?, ?, ?)', 
            [ctx.from.id, 'SOS', new Date().toLocaleString()]);
        ctx.editMessageText(getTxt(lang, 'report_sent'));
    });
});
bot.action('cancel_sos', (ctx) => ctx.deleteMessage());

// Погода
bot.hears(['☁️ Погода', '☁️ Аба ырайы'], (ctx) => {
    withUserLang(ctx, (lang) => {
        ctx.reply(`${getTxt(lang, 'weather_info')}: ${globalDeficit}%`);
    });
});

bot.launch();
app.listen(PORT, () => {
    console.log(`Site: ${SITE_URL}`);
    console.log(`Bot running...`);
});

process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(); });
