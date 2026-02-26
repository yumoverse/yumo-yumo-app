"use client"

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/context";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  Sparkles, 
  Coins, 
  Receipt, 
  Zap, 
  Users, 
  Shield, 
  TrendingUp, 
  Rocket,
  ArrowRight,
  Wallet,
  FileText,
  CheckCircle2,
  Lightbulb,
  Target,
  Globe
} from "lucide-react";

// Icon mapping for sections
const getSectionIcon = (index: number) => {
  const icons = [
    Sparkles, Coins, Receipt, Zap, Users, Wallet, Globe, Target, TrendingUp, Rocket, CheckCircle2, FileText
  ];
  return icons[index % icons.length];
};

// Color gradients for sections
const getSectionGradient = (index: number) => {
  const gradients = [
    "from-purple-500 to-pink-500",
    "from-pink-500 to-orange-500",
    "from-orange-500 to-yellow-500",
    "from-yellow-500 to-green-500",
    "from-green-500 to-blue-500",
    "from-blue-500 to-purple-500",
    "from-purple-600 to-pink-600",
    "from-pink-600 to-orange-600",
    "from-orange-600 to-red-600",
    "from-red-600 to-purple-600",
    "from-indigo-500 to-purple-500",
    "from-cyan-500 to-blue-500"
  ];
  return gradients[index % gradients.length];
};

export default function FunpaperPage() {
  const { locale } = useLocale();
  const [hoveredSection, setHoveredSection] = useState<number | null>(null);
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  const funpaperContent: Record<string, any> = {
    en: {
      sections: [
        {
          title: "1. So… what is Yumo Yumo?",
          content: "Yumo Yumo is a Web3 project that lets you mine tokens by doing something you already do every day:\n\nSpending money.\n\nEvery price has layers.\n\nTaxes, profit margins, operational costs...\n\nYou pay all of them every day, without thinking.\n\nYumo Yumo looks at these layers and says:\n\n\"Great! Let's turn this into mining.\""
        },
        {
          title: "2. Why should anyone care?",
          content: "Because almost all financial tools ask this boring question:\n\n\"How much did you spend?\"\n\nYumo Yumo asks something better:\n\n\"What was actually inside that price?\"\n\nOnce you start looking at prices this way, spending stops being a passive action.\n\nIt becomes data.\n\nAnd data earns."
        },
        {
          title: "3. Proof of Expense (PoE)",
          content: "PoE (Proof of Expense) is simple and honest.\n\n• You upload a real receipt.\n• The system analyzes what's inside the price.\n• Hidden costs come to light.\n• You earn tokens because you provided real-world data.\n\nNo fake actions.\n\nNo button clicking with bots.\n\nNo rewards that come \"just from feelings\".\n\nIf you spend in real life, you can mine on Yumo Yumo."
        },
        {
          title: "4. Mining, but make it normal life",
          content: "Forget GPUs.\n\nForget warehouses full of machines.\n\nIn Yumo Yumo, your receipts are your mining devices.\n\nEvery valid receipt adds a signal to the system.\n\nEvery signal generates tokens.\n\nThe cycle is clean:\n\nSpend → Upload → Mine → Earn\n\nYou were already doing step one anyway."
        },
        {
          title: "5. About tokens (community first)",
          content: "Let's be clear:\n\nNo team allocation.\n\nNo hidden stash.\n\nNo massive budgets set aside for marketing.\n\nNo pre-minting tokens for insiders.\n\nYumo Yumo was built so tokens flow to participants, not a central structure.\n\nIf you contribute, you earn.\n\nIf you don't, you don't.\n\nThat's it."
        },
        {
          title: "6. \"But how is this funded?\"",
          content: "It's not funded the usual way.\n\nNo massive marketing budgets.\n\nNo paid advertising machines.\n\nNo artificial demand.\n\nYumo Yumo grows through the Web3 way:\n\nThrough participation, contribution, and shared incentives.\n\nValue comes from what people do, not from team promises."
        },
        {
          title: "7. Why Web3 at all?",
          content: "Because rules matter more than people.\n\nWeb3 guarantees:\n\n• Rewards follow predefined logic.\n• Distribution cannot be changed manually.\n• No one behind the curtain can decide \"who gets what\".\n\nSpending becomes a shared signal.\n\nTokens flow back to the people who create that signal.\n\nSimple systems survive.\n\nNon-transparent ones get eliminated."
        },
        {
          title: "8. Who is this actually for?",
          content: "• People who spend money.\n• Those who love mining but also want to sleep.\n• Those who prefer rules over stories.\n\nYou don't need to trade.\n\nYou don't need to use leverage.\n\nYou don't need to predict charts.\n\nJust upload receipts."
        },
        {
          title: "9. The bigger picture",
          content: "Yumo Yumo starts with awareness.\n\nOver time, this awareness becomes:\n\n• Deeper insights.\n• Smarter financial tools.\n• A growing ecosystem built on real spending data.\n\nAll supported by the people who actually spend the money."
        },
        {
          title: "10. Final thought",
          content: "Money already leaves your wallet every day.\n\nYumo Yumo doesn't try to stop that.\n\nIt just lets you mine while it happens."
        },
        {
          title: "The Cycle",
          content: "Spend\n\nUpload\n\nMine\n\nEarn\n\nThat's the cycle."
        }
      ],
      whitepaperLink: "https://yumo-yumo.gitbook.io/whitepaper",
      readTechnicalDocs: "Read the Technical Documents"
    },
    tr: {
      sections: [
        {
          title: "1. Peki... Yumo Yumo Nedir?",
          content: "Yumo Yumo, zaten her gün yaptığın bir şeyi yaparak token madenciliği yapmanı sağlayan bir Web3 projesidir:\n\nPara harcamak.\n\nHer fiyatın katmanları vardır.\n\nVergiler, kâr marjları, operasyonel maliyetler...\n\nHepsini her gün, hiç düşünmeden ödersin.\n\nYumo Yumo bu katmanlara bakar ve der ki:\n\n\"Harika! Gel bunu madenciliğe (mining) dönüştürelim.\""
        },
        {
          title: "2. Neden İnsanların Umurunda Olsun?",
          content: "Çünkü neredeyse tüm finans araçları şu sıkıcı soruyu sorar:\n\n\"Ne kadar harcadın?\"\n\nYumo Yumo daha iyisini sorar:\n\n\"O fiyatın içinde aslında neler vardı?\"\n\nFiyatlara bu gözle bakmaya başladığında, harcama yapmak pasif bir eylem olmaktan çıkar.\n\nVeriye dönüşür.\n\nVe veri kazandırır."
        },
        {
          title: "3. Harcama Kanıtı (Proof of Expense - PoE)",
          content: "PoE (Harcama Kanıtı) basit ve dürüsttür.\n\n• Gerçek bir fiş yüklersin.\n• Sistem fiyatın içindekileri analiz eder.\n• Gizli maliyetler gün yüzüne çıkar.\n• Gerçek dünya verisi sağladığın için token kazanırsın.\n\nSahte aksiyon yok.\n\nBotlarla buton tıklamak yok.\n\n\"Sadece hislerle\" gelen ödüller yok.\n\nEğer gerçek hayatta harcıyorsan, Yumo Yumo'da madencilik yapabilirsin."
        },
        {
          title: "4. Madencilik, Ama Günlük Hayatın İçinde",
          content: "GPU'ları (ekran kartlarını) unut.\n\nMakine dolu depoları unut.\n\nYumo Yumo'da fişlerin, senin madencilik cihazlarındır.\n\nHer geçerli fiş, sisteme bir sinyal ekler.\n\nHer sinyal, token üretir.\n\nDöngü tertemizdir:\n\nHarca → Yükle → Kaz → Kazan\n\nZaten birinci adımı her halükarda yapıyordun."
        },
        {
          title: "5. Tokenlar Hakkında (Önce Topluluk)",
          content: "Net olalım:\n\nEkip tahsisi (allocation) yok.\n\nGizli zula yok.\n\nPazarlama için ayrılmış dev bütçeler yok.\n\nİçeriden birilerinin önceden token basması yok.\n\nYumo Yumo, tokenların merkezi bir yapıya değil, katılımcılara akması için inşa edildi.\n\nKatkı sağlarsan kazanırsın.\n\nSağlamazsan kazanamazsın.\n\nBu kadar."
        },
        {
          title: "6. \"Peki Bu İş Nasıl Fonlanıyor?\"",
          content: "Alışılagelmiş yollarla fonlanmıyor.\n\nDevasa pazarlama bütçeleri yok.\n\nParayla tutulmuş reklam makineleri yok.\n\nYapay bir talep yok.\n\nYumo Yumo, Web3 yoluyla büyür:\n\nKatılım, katkı ve paylaşılan teşviklerle.\n\nDeğer, ekibin vaatlerinden değil, insanların yaptıklarından gelir."
        },
        {
          title: "7. Neden Web3?",
          content: "Çünkü kurallar insanlardan daha önemlidir.\n\nWeb3 şunları garanti eder:\n\n• Ödüller önceden tanımlanmış bir mantığı takip eder.\n• Dağıtım manuel olarak değiştirilemez.\n• Perde arkasında kimse \"kimin ne alacağına\" karar veremez.\n\nHarcamalar ortak bir sinyale dönüşür.\n\nTokenlar, o sinyali oluşturan insanlara geri akar.\n\nBasit sistemler hayatta kalır.\n\nŞeffaf olmayanlar ise elenir."
        },
        {
          title: "8. Bu Aslında Kimin İçin?",
          content: "• Para harcayan insanlar.\n• Madenciliği seven ama uykusunu da almak isteyenler.\n• Hikayeler yerine kuralları tercih edenler.\n\nTrade yapmana gerek yok.\n\nKaldıraç kullanmana gerek yok.\n\nGrafik tahmin etmene gerek yok.\n\nSadece fişleri yüklersin."
        },
        {
          title: "9. Büyük Resim",
          content: "Yumo Yumo bir farkındalıkla başlar.\n\nZamanla bu farkındalık şuna dönüşür:\n\n• Daha derin içgörüler.\n• Daha akıllı finansal araçlar.\n• Gerçek harcama verileri üzerine kurulu, büyüyen bir ekosistem.\n\nHepsi, parayı asıl harcayan insanlar tarafından desteklenir."
        },
        {
          title: "10. Son Düşünce",
          content: "Cüzdanından her gün zaten para çıkıyor.\n\nYumo Yumo bunu durdurmaya çalışmaz.\n\nSadece bu olurken madencilik yapmanı sağlar."
        },
        {
          title: "Döngü",
          content: "Harca\n\nYükle\n\nKaz\n\nKazan\n\nİşte döngü bu."
        }
      ],
      whitepaperLink: "https://yumo-yumo.gitbook.io/whitepaper",
      readTechnicalDocs: "Teknik Dokümanları Oku"
    },
    th: {
      sections: [
        {
          title: "1. Yumo Yumo คือโปรเจกต์ Web3 สุดล้ำที่จะช่วยให้คุณ \"ขุดโทเคน\" ได้ง่ายๆ จากสิ่งที่คุณทำอยู่แล้วทุกวัน... นั่นก็คือ การใช้จ่ายเงิน นั่นเอง! 💸",
          content: "รู้ไหมว่าในทุกๆ ราคาที่เราจ่ายไป มันมี \"เลเยอร์\" ซ่อนอยู่ข้างในเสมอ:\n\nภาษีต่างๆ ภาษีมูลค่าเพิ่ม\n\nกำไรของร้านค้า\n\nค่าใช้จ่ายในการดำเนินงาน...\n\nคุณจ่ายสิ่งเหล่านี้อยู่ทุกวันโดยที่ไม่เคยคิดถึงมันเลย แต่ Yumo Yumo มองเห็นเลเยอร์เหล่านี้แล้วบอกว่า:\n\n\"เจ๋งไปเลย! มาเปลี่ยนสิ่งเหล่านี้ให้เป็นพลังในการขุดโทเคนกันดีกว่า!\" 🍎⛏️"
        },
        {
          title: "2. ทำไมคุณถึงต้องสนใจล่ะ? 🤔",
          content: "เพราะเครื่องมือทางการเงินเกือบทั้งหมดมักจะถามคำถามเดิมๆ ที่น่าเบื่อว่า:\n\n\"คุณจ่ายไปเท่าไหร่?\"\n\nแต่ Yumo Yumo ถามสิ่งที่เจ๋งกว่านั้น:\n\n\"จริงๆ แล้วมีอะไรซ่อนอยู่ในราคานั้นบ้าง?\"\n\nเมื่อคุณเริ่มมองราคาในมุมนี้ การใช้จ่ายจะไม่ใช่แค่การจ่ายทิ้งอีกต่อไป\n\nแต่มันจะกลายเป็น \"ข้อมูล\"\n\nและข้อมูลนี่แหละที่สร้างรายได้ให้คุณ!"
        },
        {
          title: "3. Proof of Expense (PoE) — เรียบง่ายและซื่อสัตย์ 🧾",
          content: "ระบบ PoE ของเราตรงไปตรงมาที่สุด:\n\n• คุณอัปโหลดใบเสร็จจริงๆ\n• ระบบจะวิเคราะห์สิ่งที่อยู่ภายในราคานั้น\n• ต้นทุนที่แฝงอยู่จะถูกเปิดเผยออกมา\n• คุณได้รับโทเคน เพราะคุณได้ให้ข้อมูลจากโลกแห่งความเป็นจริง\n\nไม่มีการสร้างยอดปลอม ไม่มีบอทคลิก และไม่มีรางวัลที่ให้ตามความรู้สึก\n\nทุกอย่างขับเคลื่อนด้วยข้อมูลจริงจากการใช้จ่ายของคุณ"
        },
        {
          title: "4. ขุดโทเคนได้ง่ายๆ ในชีวิตประจำวัน 🏠",
          content: "ลืมการ์ดจอแรงๆ หรือโกดังที่เต็มไปด้วยเครื่องขุดไปได้เลย เพราะที่ Yumo Yumo \"ใบเสร็จของคุณคือเครื่องขุด\"\n\nทุกใบเสร็จที่ถูกต้องคือการส่งสัญญาณเข้าสู่ระบบ และทุกสัญญาณจะสร้างโทเคนออกมา\n\nวงจรนั้นง่ายมาก:\n\nจ่าย → อัปโหลด → ขุด → รับรางวัล\n\n(ซึ่งปกติคุณก็ทำขั้นตอนแรกอยู่แล้วทุกวันจริงไหม?)"
        },
        {
          title: "5. เกี่ยวกับโทเคน (ชุมชนต้องมาก่อน) 🍪",
          content: "ขอพูดชัดๆ ตรงนี้เลยว่า:\n\nไม่มี การแบ่งให้ทีมงาน\n\nไม่มี การเก็บงำไว้ลับๆ\n\nไม่มี งบการตลาดมหาศาล\n\nไม่มี การแอบเสกเหรียญให้คนใน (Pre-minting)\n\nYumo Yumo ถูกสร้างมาเพื่อให้โทเคนไหลไปสู่ผู้เข้าร่วมตัวจริง ไม่ใช่โครงสร้างส่วนกลาง\n\nถ้าคุณช่วยสร้าง คุณก็ได้รับ\n\nถ้าไม่ ก็คือไม่\n\nจบแค่นั้นครับ"
        },
        {
          title: "6. \"แล้วเอาเงินทุนมาจากไหน?\" 💰",
          content: "เราไม่ได้ระดมทุนแบบเดิมๆ\n\nไม่มีงบโฆษณาจ้างคนดัง หรือการสร้างความต้องการปลอมๆ\n\nYumo Yumo เติบโตในวิถีของ Web3:\n\nเติบโตผ่านการมีส่วนร่วม และแรงจูงใจที่แบ่งปันร่วมกัน\n\nมูลค่ามาจากสิ่งที่ผู้คนทำจริงๆ ไม่ใช่แค่คำสัญญาจากทีมงาน"
        },
        {
          title: "7. ทำไมต้องเป็น Web3? 🌐",
          content: "เพราะ \"กฎเกณฑ์\" สำคัญกว่าตัวบุคคล\n\nWeb3 การันตีว่า:\n\n• รางวัลจะเป็นไปตามตรรกะที่กำหนดไว้ล่วงหน้า\n• การกระจายเหรียญไม่สามารถแก้ไขด้วยมือได้\n• ไม่มีใคร \"หลังม่าน\" มาตัดสินใจได้ว่าใครจะได้อะไร\n\nการใช้จ่ายกลายเป็นสัญญาณร่วมกัน\n\nและโทเคนจะไหลกลับไปสู่ผู้คนที่สร้างสัญญาณนั้น\n\nระบบที่โปร่งใสจะอยู่รอด ส่วนระบบที่ไม่ชัดเจนจะถูกคัดออกไปเอง"
        },
        {
          title: "8. โปรเจกต์นี้เหมาะกับใคร? 👥",
          content: "• คนที่ใช้จ่ายเงิน (ซึ่งก็คือทุกคน!)\n• คนที่รักการขุดเหรียญ แต่ก็อยากนอนหลับให้เต็มอิ่ม\n• คนที่เชื่อในกฎกติกามากกว่าคำพูดสวยหรู\n\nคุณไม่จำเป็นต้องเทรด\n\nไม่ต้องใช้ Leverage\n\nไม่ต้องทำนายกราฟ\n\nแค่โชว์ใบเสร็จก็พอ"
        },
        {
          title: "9. ภาพรวมที่ใหญ่กว่า 🖼️",
          content: "Yumo Yumo เริ่มต้นจากการสร้างความตระหนักรู้\n\nและเมื่อเวลาผ่านไป สิ่งนี้จะกลายเป็น:\n\n• ข้อมูลเชิงลึกที่ลึกซึ้งขึ้น\n• เครื่องมือทางการเงินที่ฉลาดกว่าเดิม\n• ระบบนิเวศที่เติบโตบนฐานข้อมูลการใช้จ่ายจริง\n\nทั้งหมดนี้ขับเคลื่อนโดยผู้คนที่จ่ายเงินซื้อของจริงๆ อย่างพวกเราทุกคน"
        },
        {
          title: "10. ทิ้งท้ายสักนิด ✨",
          content: "เงินออกจากกระเป๋าคุณทุกวันอยู่แล้ว\n\nYumo Yumo ไม่ได้พยายามหยุดสิ่งนั้น\n\nเราแค่ช่วยให้คุณ \"ขุดเหรียญ\" ไปพร้อมกับมันได้ต่างหาก!"
        },
        {
          title: "วงจรความรวย",
          content: "จ่าย\n\nอัปโหลด\n\nขุด\n\nรับรางวัล\n\nนั่นแหละคือทั้งหมด!"
        }
      ],
      whitepaperLink: "https://yumo-yumo.gitbook.io/whitepaper",
      readTechnicalDocs: "อ่านเอกสารทางเทคนิค"
    },
    ru: {
      sections: [
        {
          title: "1. Итак… что такое Yumo Yumo? 🍎",
          content: "Yumo Yumo — это Web3-проект, который позволяет тебе добывать (майнить) токены, делая то, что ты и так делаешь каждый день:\n\nТратить деньги.\n\nВ каждой цене есть скрытые слои: налоги, маржа, операционные расходы...\n\nТы оплачиваешь их ежедневно, не задумываясь.\n\nYumo Yumo смотрит на эти слои и говорит:\n\n\"Круто! Давай превратим это в майнинг.\""
        },
        {
          title: "2. Почему это важно? 🤔",
          content: "Почти все финансовые инструменты задают скучный вопрос:\n\n\"Сколько ты потратил?\"\n\nYumo Yumo спрашивает кое-что получше:\n\n\"Что на самом деле было внутри этой цены?\"\n\nКак только ты начинаешь смотреть на цены под этим углом, траты перестают быть пассивным действием.\n\nОни становятся данными.\n\nА данные приносят доход."
        },
        {
          title: "3. Proof of Expense (PoE) — Доказательство Расходов 🧾",
          content: "PoE — это просто и честно:\n\n• Ты загружаешь реальный чек.\n• Система анализирует, что внутри цены.\n• Скрытые расходы выходят на свет.\n• Ты получаешь токены, потому что предоставил реальные данные.\n\nНикаких фальшивых действий.\n\nНикаких ботов.\n\nНикаких наград «просто так».\n\nЕсли ты тратишь в реальной жизни — ты можешь майнить в Yumo Yumo."
        },
        {
          title: "4. Майнинг как часть обычной жизни 🏠",
          content: "Забудь о видеокартах и складах, забитых оборудованием.\n\nВ Yumo Yumo твои чеки — это твои майнинг-фермы.\n\nКаждый валидный чек — это сигнал для системы.\n\nКаждый сигнал генерирует токены.\n\nЦикл предельно чист:\n\nПотратил → Загрузил → Смайнил → Заработал\n\nПервый шаг ты всё равно уже сделал."
        },
        {
          title: "5. О токенах (сообщество прежде всего) 🍪",
          content: "Давай проясним:\n\nНикаких долей для команды.\n\nНикаких скрытых заначек.\n\nНикаких огромных бюджетов на маркетинг.\n\nНикакого пре-минта для «своих».\n\nYumo Yumo построен так, чтобы токены текли к участникам, а не в центральную структуру.\n\nПомогаешь — зарабатываешь.\n\nНет — значит нет.\n\nВсё просто."
        },
        {
          title: "6. «А как это финансируется?» 💰",
          content: "Не так, как обычно.\n\nУ нас нет рекламных машин и искусственного спроса.\n\nYumo Yumo растет по пути Web3:\n\nчерез участие, вклад и общие стимулы.\n\nЦенность создается действиями людей, а не обещаниями команды."
        },
        {
          title: "7. Зачем вообще здесь Web3? 🌐",
          content: "Потому что правила важнее людей.\n\nWeb3 гарантирует:\n\n• Награды выплачиваются по заранее прописанной логике.\n• Распределение нельзя изменить вручную.\n• Никто «за кулисами» не решает, кому и сколько дать.\n\nТвои траты становятся общим сигналом, а токены возвращаются к тем, кто этот сигнал создал.\n\nПрозрачные системы выживают, закрытые — исчезают."
        },
        {
          title: "8. Для кого это? 👥",
          content: "• Для тех, кто тратит деньги.\n• Для тех, кто любит майнинг, но хочет при этом спокойно спать.\n• Для тех, кто предпочитает правила сказкам.\n\nТебе не нужно торговать.\n\nТебе не нужно использовать плечи.\n\nТебе не нужно угадывать графики.\n\nПросто загружай чеки."
        },
        {
          title: "9. Большая картина 🖼️",
          content: "Yumo Yumo начинается с осознанности.\n\nСо временем эта осознанность превращается в:\n\n• Глубокую аналитику.\n• Умные финансовые инструменты.\n• Растущую экосистему на базе данных о реальных тратах.\n\nИ всё это поддерживается людьми, которые реально тратят деньги."
        },
        {
          title: "10. Финальная мысль ✨",
          content: "Деньги и так покидают твой кошелек каждый день.\n\nYumo Yumo не пытается это остановить.\n\nОн просто позволяет тебе майнить, пока это происходит."
        },
        {
          title: "Цикл",
          content: "Трать\n\nЗагружай\n\nМайни\n\nЗарабатывай\n\nВот и весь цикл."
        }
      ],
      whitepaperLink: "https://yumo-yumo.gitbook.io/whitepaper",
      readTechnicalDocs: "Читать техническую документацию"
    },
    es: {
      sections: [
        {
          title: "1. Entonces... ¿qué es Yumo Yumo?",
          content: "Yumo Yumo es un proyecto Web3 que te permite minar tokens haciendo algo que ya haces todos los días:\n\nGastar dinero.\n\nCada precio tiene capas ocultas: impuestos, márgenes de beneficio, costos operativos...\n\nLos pagas a diario sin pensarlo.\n\nYumo Yumo analiza esas capas y dice:\n\n\"¡Genial! Convirtamos este gasto en minería\"."
        },
        {
          title: "2. ¿Por qué debería importarte?",
          content: "Casi todas las herramientas financieras te hacen la misma pregunta aburrida:\n\n\"¿Cuánto gastaste?\"\n\nYumo Yumo hace una pregunta mucho mejor:\n\n\"¿Qué había realmente dentro de ese precio?\"\n\nCuando empiezas a ver los precios así, gastar deja de ser una acción pasiva.\n\nSe convierte en datos, y los datos generan valor."
        },
        {
          title: "3. Proof of Expense (PoE): Simple y Honesto",
          content: "El sistema PoE es transparente:\n\n• Subes un recibo real.\n• El sistema desglosa los costos ocultos.\n• Ganas tokens por aportar datos del mundo real.\n• Sin bots, sin acciones falsas, sin recompensas basadas en \"humo\".\n\nSi gastas en la vida real, minas en Yumo Yumo."
        },
        {
          title: "4. Minería para la vida normal",
          content: "Olvida las tarjetas gráficas costosas y los almacenes llenos de máquinas.\n\nEn Yumo Yumo, tus recibos son tus nodos de minería.\n\nCada tique válido envía una señal al sistema y genera tokens.\n\nEl ciclo es perfecto:\n\nGasta → Sube → Mina → Gana\n\nYa estabas haciendo el paso uno de todos modos.\n\n¿Por qué no ganar con ello?"
        },
        {
          title: "5. Tokenomics: La comunidad es lo primero",
          content: "Seamos claros:\n\nSin asignación para el equipo.\n\nSin reservas ocultas.\n\nSin preventas para insiders.\n\nYumo Yumo se construyó para que los tokens fluyan hacia quienes participan, no hacia una estructura centralizada.\n\nSi contribuyes, ganas.\n\nAsí de simple."
        },
        {
          title: "6. \"¿Cómo se financia esto?\"",
          content: "No seguimos el camino tradicional. Sin presupuestos millonarios de marketing ni demanda artificial. Yumo Yumo crece de forma orgánica: a través de la participación real y los incentivos compartidos. El valor nace de lo que la gente hace, no de las promesas de un equipo."
        },
        {
          title: "7. ¿Por qué Web3?",
          content: "Porque las reglas importan más que las personas.\n\nWeb3 garantiza que:\n\n• Las recompensas sigan una lógica matemática inmutable.\n• Nadie pueda cambiar la distribución manualmente.\n• No haya nadie \"detrás de la cortina\" decidiendo quién gana qué.\n\nLos sistemas transparentes sobreviven; los opacos, desaparecen."
        },
        {
          title: "8. ¿Para quién es esto realmente?",
          content: "• Para quienes gastan dinero (o sea, todos).\n• Para quienes aman la minería pero también quieren dormir tranquilos.\n• Para quienes prefieren reglas claras antes que historias bonitas.\n\nNo necesitas hacer trading ni entender gráficos complejos.\n\nSolo sube tus recibos."
        },
        {
          title: "9. La visión global",
          content: "Yumo Yumo empieza con la conciencia. Con el tiempo, esa conciencia se convierte en herramientas financieras inteligentes y un ecosistema basado en datos reales, impulsado por las personas que realmente mueven la economía."
        },
        {
          title: "10. Reflexión final",
          content: "El dinero ya sale de tu bolsillo cada día.\n\nYumo Yumo no intenta detener eso; simplemente te permite minar mientras sucede."
        },
        {
          title: "El Ciclo",
          content: "Gastar\n\nSubir\n\nMinar\n\nGanar"
        }
      ],
      whitepaperLink: "https://yumo-yumo.gitbook.io/whitepaper",
      readTechnicalDocs: "Leer Documentación Técnica"
    },
    zh: {
      sections: [
        {
          title: "1. 所以……Yumo Yumo 是什么？",
          content: "Yumo Yumo 是一个 Web3 项目， 让你通过一件每天本来就在做的事， 获得代币奖励。\n\n那件事就是——花钱。\n\n每一个价格， 其实都有很多层。\n\n税费、利润、运营成本……\n\n你每天都在支付这些， 只是从来没有仔细想过。\n\nYumo Yumo 看着这些层级，说了一句：\n\n\"太好了，我们把它变成一种参与方式吧。\""
        },
        {
          title: "2. 那为什么要在意？",
          content: "因为几乎所有理财工具， 都会问一个很无聊的问题：\n\n\"你花了多少钱？\"\n\nYumo Yumo 问的是另一个问题：\n\n\"这个价格里面，到底装了什么？\"\n\n一旦你开始这样看待消费， 花钱就不再只是一个被动动作。\n\n它会变成数据。\n\n而数据，是有价值的。"
        },
        {
          title: "3. 什么是支出证明（PoE）？",
          content: "PoE（Proof of Expense）很简单，也很诚实。\n\n• 你上传一张真实的收据\n• 系统解析价格结构\n• 原本看不见的部分被摊开\n• 因为你提供了真实世界的数据，你获得奖励\n\n没有假操作。\n\n没有机器人点按钮。\n\n没有\"感觉对了就发奖励\"。\n\n只要你在现实生活中消费， 就可以在 Yumo Yumo 中参与。"
        },
        {
          title: "4. 挖矿，但它就是日常生活",
          content: "忘掉显卡吧。\n\n忘掉机器仓库吧。\n\n在 Yumo Yumo 里， 你的收据就是你的\"设备\"。\n\n每一张有效收据， 都会为系统提供一个信号。\n\n每一个信号， 都会产生奖励。\n\n流程非常干净：\n\n花钱 → 上传 → 参与 → 获得\n\n而第一步， 你本来就每天在做。"
        },
        {
          title: "5. 关于代币（社区优先）",
          content: "我们说清楚一件事：\n\n没有团队专属分配。\n\n没有隐藏储备。\n\n没有巨额营销预算。\n\n没有给内部人员预留的代币。\n\nYumo Yumo 的设计目标只有一个：\n\n让价值流向参与者， 而不是某个中心结构。\n\n你参与，你获得。\n\n你不参与，就不会获得。\n\n就这么简单。"
        },
        {
          title: "6. \"那这个系统靠什么运转？\"",
          content: "它不是用传统方式运转的。\n\n没有大规模广告。\n\n没有烧钱买流量。\n\n没有人为制造需求。\n\nYumo Yumo 以 Web3 的方式成长：\n\n靠参与、靠贡献、靠共同激励。\n\n价值来自人们做了什么， 而不是团队说了什么。"
        },
        {
          title: "7. 为什么一定要用 Web3？",
          content: "因为规则， 比人更重要。\n\nWeb3 确保：\n\n• 奖励遵循预先设定的逻辑\n• 分配无法被手动更改\n• 没有人可以在幕后决定\"谁拿多少\"\n\n消费行为变成一种共享信号。\n\n代币， 会回到创造这个信号的人手中。\n\n简单的系统， 才能长期存在。\n\n不透明的系统， 最终会被淘汰。"
        },
        {
          title: "8. 这到底适合谁？",
          content: "• 会花钱的人\n• 喜欢参与，但也想好好睡觉的人\n• 更相信规则，而不是故事的人\n\n你不需要交易。\n\n不需要加杠杆。\n\n不需要预测走势图。\n\n只需要上传收据。"
        },
        {
          title: "9. 更大的图景",
          content: "Yumo Yumo 从\"看懂消费\"开始。\n\n随着时间推移， 这种认知会变成：\n\n• 更深入的洞察\n• 更聪明的工具\n• 一个建立在真实消费数据之上的生态系统\n\n而支撑这一切的， 正是那些每天在花钱的人。"
        },
        {
          title: "10. 最后的话",
          content: "钱每天都会离开你的钱包。\n\nYumo Yumo 并不会阻止它。\n\n它只是让你在这个过程中， 顺便获得一些东西。"
        },
        {
          title: "循环",
          content: "花钱\n\n上传\n\n参与\n\n获得"
        }
      ],
      whitepaperLink: "https://yumo-yumo.gitbook.io/whitepaper",
      readTechnicalDocs: "阅读技术文档"
    }
  };

  const content = funpaperContent[locale] || funpaperContent.en;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-40 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20"
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 left-1/2 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-xl opacity-20"
          animate={{
            x: [0, 50, 0],
            y: [0, -100, 0],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="container mx-auto px-4 py-12 md:py-20 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Hero Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <motion.div
              className="inline-block mb-6"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="text-6xl mb-4">🎉</div>
            </motion.div>
            <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-primary via-pink-500 to-orange-500 bg-clip-text text-transparent">
              Fun Paper
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              The not-so-serious guide to the most serious Web3 project
            </p>
          </motion.div>

          {/* Sections */}
          <div className="space-y-8">
            {content.sections && content.sections.length > 0 ? (
              content.sections.map((section: any, index: number) => {
                const Icon = getSectionIcon(index);
                const gradient = getSectionGradient(index);
                const isHovered = hoveredSection === index;
                const isCycleSection = section.title.toLowerCase().includes('cycle');

                return (
                  <motion.section
                    key={index}
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    onHoverStart={() => setHoveredSection(index)}
                    onHoverEnd={() => setHoveredSection(null)}
                    className="relative"
                  >
                    {/* Special styling for Cycle section */}
                    {isCycleSection ? (
                      <motion.div
                        className="relative bg-gradient-to-br from-primary/20 via-pink-500/20 to-orange-500/20 backdrop-blur-xl rounded-3xl p-8 md:p-12 border-4 border-primary/50 shadow-2xl"
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <div className="absolute top-4 right-4 text-4xl animate-bounce">✨</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                          {['Spend', 'Upload', 'Mine', 'Earn'].map((step, stepIndex) => (
                            <motion.div
                              key={stepIndex}
                              className="text-center"
                              initial={{ opacity: 0, scale: 0.8 }}
                              whileInView={{ opacity: 1, scale: 1 }}
                              viewport={{ once: true }}
                              transition={{ delay: stepIndex * 0.2 }}
                            >
                              <motion.div
                                className={`w-20 h-20 rounded-full bg-gradient-to-br ${getSectionGradient(stepIndex)} mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold shadow-lg`}
                                whileHover={{ scale: 1.1, rotate: 360 }}
                                transition={{ duration: 0.5 }}
                              >
                                {stepIndex + 1}
                              </motion.div>
                              <h3 className="font-bold text-lg text-white">{step}</h3>
                            </motion.div>
                          ))}
                        </div>
                        <p className="text-center text-2xl font-bold text-white">
                          That's the cycle. Simple. Clean. Powerful.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        className={`relative bg-white/5 backdrop-blur-xl rounded-3xl p-8 md:p-10 border border-white/10 shadow-xl transition-all duration-300 ${
                          isHovered ? 'shadow-2xl border-primary/50' : ''
                        }`}
                        whileHover={{ 
                          scale: 1.02,
                          boxShadow: "0 20px 40px rgba(255, 122, 26, 0.2)"
                        }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        {/* Icon Badge */}
                        <motion.div
                          className={`absolute -top-6 -left-6 w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg z-10`}
                          whileHover={{ rotate: 360, scale: 1.1 }}
                          transition={{ duration: 0.5 }}
                        >
                          <Icon className="w-8 h-8 text-white" />
                        </motion.div>

                        {/* Section Number */}
                        <div className="absolute top-4 right-4">
                          <span className={`text-4xl font-bold bg-gradient-to-br ${gradient} bg-clip-text text-transparent opacity-20`}>
                            {String(index + 1).padStart(2, '0')}
                          </span>
                        </div>

                        <div className="mt-4">
                          <motion.h2
                            className={`text-2xl md:text-3xl font-bold mb-6 bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
                            whileHover={{ x: 10 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            {section.title}
                          </motion.h2>
                          
                          <div className="text-gray-300 leading-relaxed space-y-4">
                            {section.content.split(/\n\n+/).map((paragraph: string, pIndex: number) => {
                              const lines = paragraph.split('\n').filter(line => line.trim());
                              if (lines.length === 0) return null;
                              
                              // Check if it's a bullet point
                              if (lines[0].trim().match(/^[•\-\d+\.]/)) {
                                return (
                                  <motion.ul
                                    key={pIndex}
                                    className="list-none space-y-3 mb-4"
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: pIndex * 0.1 }}
                                  >
                                    {lines.map((line, lIndex) => (
                                      <motion.li
                                        key={lIndex}
                                        className="flex items-start gap-3 p-3 rounded-lg bg-white/90 hover:bg-white transition-colors text-gray-900"
                                        whileHover={{ x: 5 }}
                                      >
                                        <CheckCircle2 className={`w-5 h-5 mt-0.5 flex-shrink-0 text-primary`} />
                                        <span className="whitespace-pre-line">{line.replace(/^[•\-\d+\.]\s*/, '')}</span>
                                      </motion.li>
                                    ))}
                                  </motion.ul>
                                );
                              }
                              
                              // Regular paragraph with emphasis detection
                              const hasEmphasis = paragraph.includes('"') || paragraph.includes('•') || paragraph.match(/[A-Z][^.!?]*!/);
                              return (
                                <motion.p
                                  key={pIndex}
                                  className={`mb-4 whitespace-pre-line ${
                                    hasEmphasis 
                                      ? 'text-lg font-semibold text-white bg-gradient-to-r from-primary/20 to-pink-500/20 p-4 rounded-xl border-l-4 border-primary' 
                                      : 'text-gray-300'
                                  }`}
                                  initial={{ opacity: 0 }}
                                  whileInView={{ opacity: 1 }}
                                  viewport={{ once: true }}
                                  transition={{ delay: pIndex * 0.1 }}
                                >
                                  {paragraph}
                                </motion.p>
                              );
                            })}
                          </div>
                        </div>

                        {/* Hover glow effect */}
                        {isHovered && (
                          <motion.div
                            className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${gradient} opacity-5 pointer-events-none`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.1 }}
                            exit={{ opacity: 0 }}
                          />
                        )}
                      </motion.div>
                    )}
                  </motion.section>
                );
              })
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">
                  {locale === 'en' ? 'Content loading...' : 'This content is not yet available in your language. Please check back later.'}
                </p>
              </div>
            )}
          </div>

          {/* CTA Section */}
          {content.sections && content.sections.length > 0 && (
            <motion.div
              className="mt-16 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10"
                  animate={{
                    backgroundPosition: ['0% 0%', '100% 100%'],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                />
                <div className="relative z-10">
                  <motion.div
                    className="text-6xl mb-6"
                    animate={{
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    🚀
                  </motion.div>
                  <h3 
                    className="text-3xl md:text-4xl font-bold text-white mb-6"
                    style={{
                      textShadow: '0 0 20px rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    Ready to dive deeper?
                  </h3>
                  <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
                    Get all the technical details, tokenomics, and implementation processes
                  </p>
                  <motion.a
                    href={content.whitepaperLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-purple-600 font-bold text-lg hover:bg-gray-100 transition-colors shadow-xl"
                    style={{
                      boxShadow: '0 0 30px rgba(255, 255, 255, 0.3)'
                    }}
                    whileHover={{ 
                      scale: 1.05, 
                      boxShadow: "0 0 40px rgba(255, 255, 255, 0.5), 0 10px 30px rgba(0,0,0,0.5)" 
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {content.readTechnicalDocs || "Read the Technical Documents"}
                    <ArrowRight className="w-6 h-6" />
                  </motion.a>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
