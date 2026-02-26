"use client"

import React from "react";
import { useLocale } from "@/lib/i18n/context";

export default function PrivacyPage() {
  const { locale } = useLocale();

  const privacyContent: Record<string, any> = {
    en: {
      title: "Yumo Yumo Privacy Policy",
      lastUpdated: "Last Updated: December 19, 2025",
      intro: "Hi friend! We really care about your privacy — like, a lot. This policy explains how we handle your info in the gentlest way possible.",
      sections: [
        {
          title: "1. What we collect (only the necessities)",
          content: "• Your wallet address (when you connect — it's public on blockchain anyway).\n• Receipts you upload (to give you those cool insights).\n• Basic device stuff (like which phone or browser you're using) so the app works smoothly.\n• Chats if you reach out to us.\n• We don't grab sensitive stuff unless it accidentally sneaks onto a receipt (please don't share things like health info!)."
        },
        {
          title: "2. How we use your info",
          content: "• To show you hidden costs and cute spending breakdowns.\n• To calculate your well-deserved rewards.\n• To make the app better (using anonymized data only — no one knows it's you).\n• To keep everything safe and running."
        },
        {
          title: "3. Anonymization — our favorite magic trick",
          content: "When we improve the app or create general stats (like \"dining costs in Bangkok\"), we strip away anything that could point to you. Your receipts help everyone, but stay private."
        },
        {
          title: "4. Who sees your info?",
          content: "Almost nobody!\n\n• Trusted helpers (cloud services, analytics) who promise to be good.\n• Blockchain (for rewards — that part is public by design).\n• Only if the law asks (very rare and boring).\n\nWe never sell your data. Pinky promise."
        },
        {
          title: "5. Blockchain is forever",
          content: "Once rewards hit the chain, they're public (wallet address + amounts). That's just how Web3 works — super transparent!"
        },
        {
          title: "6. Keeping things safe",
          content: "We use strong locks and careful habits to protect your info. Nothing is 100% unbreakable, but we try our very best."
        },
        {
          title: "7. How long we keep stuff",
          content: "Only as long as we need it to help you or follow rules. Want something deleted? Just ask!"
        },
        {
          title: "8. Your rights (you're in control)",
          content: "Depending on where you live, you can:\n\n• See your data\n• Correct or delete it\n• Say \"no thanks\" to certain uses\n\nJust ping us — we'll sort it with a smile."
        },
        {
          title: "9. We travel sometimes",
          content: "Your data might visit servers in other countries, but we always make sure they follow strict privacy rules."
        },
        {
          title: "10. No kids allowed",
          content: "Our app is for grown-ups only (18+). We don't collect info from kids."
        },
        {
          title: "11. Updates to this policy",
          content: "If we change anything important, we'll give you a heads-up. Keep using the app = you're okay with the new version."
        },
        {
          title: "12. Questions or cozy chats?",
          content: "Reach us at support@yumoyumo.com. We love hearing from you!"
        }
      ],
      closing: "Thank you for trusting us. We're here to make money stuff less confusing and more rewarding — all while keeping your privacy safe and sound. Big hug!"
    },
    tr: {
      title: "Yumo Yumo Gizlilik Politikası",
      lastUpdated: "Son Güncelleme: 19 Aralık 2025",
      intro: "Selam dostum! Gizliliğine gerçekten çok ama çok değer veriyoruz. Bu politika, bilgilerini olabilecek en nazik şekilde nasıl işlediğimizi açıklıyor.",
      sections: [
        {
          title: "1. Neler topluyoruz? (Sadece en gerekli olanları)",
          content: "Cüzdan Adresin: Bağlandığın zaman (Zaten blockchain üzerinde halka açıktır).\nYüklediğin Fişler: Sana o havalı içgörüleri sunabilmek için.\nTemel Cihaz Bilgileri: Uygulamanın sorunsuz çalışması için hangi telefonu veya tarayıcıyı kullandığın.\nSohbetler: Bize ulaştığında kurduğumuz iletişimler.\nÖzel Not: Fişin üzerinde yanlışlıkla kalmadığı sürece hassas bilgilerini (sağlık bilgileri gibi) asla toplamayız. Lütfen bu tip detayları paylaşmamaya dikkat et, olur mu?"
        },
        {
          title: "2. Bilgilerini nasıl kullanıyoruz?",
          content: "Gizli maliyetleri ve o tatlı harcama dökümlerini sana göstermek için.\nHak ettiğin ödülleri hesaplamak için.\nUygulamayı daha iyi hale getirmek için (Sadece anonim verilerle — kimse onun sen olduğunu bilmez).\nHer şeyin güvenli ve tıkır tıkır işlemesini sağlamak için."
        },
        {
          title: "3. Anonimleştirme — En sevdiğimiz sihirli numaramız!",
          content: "Uygulamayı geliştirirken veya genel istatistikler oluştururken (örneğin: \"İstanbul'da yemek maliyetleri\"), seninle bağ kurulabilecek her şeyi silip atıyoruz. Fişlerin herkese yardımcı olur ama kimliğin hep gizli kalır."
        },
        {
          title: "4. Bilgilerini kimler görüyor?",
          content: "Neredeyse hiç kimse!\n\nGüvenilir Yardımcılar: İyi davranacağına söz veren bulut servisleri ve analiz araçları.\nBlockchain: Ödüller için — bu kısım tasarım gereği halka açıktır.\nSadece Yasalar İsterse: Çok nadir ve sıkıcı bir durum. Verilerini asla satmıyoruz. Serçe parmağımızla söz veriyoruz!"
        },
        {
          title: "5. Blockchain sonsuzdur",
          content: "Ödüller zincire ulaştığında cüzdan adresin ve miktarlar halka açık hale gelir. Web3 dünyası böyle çalışır; süper şeffaf!"
        },
        {
          title: "6. Güvenliği sağlıyoruz",
          content: "Bilgilerini korumak için güçlü kilitler ve dikkatli alışkanlıklar kullanıyoruz. Hiçbir şey %100 kırılamaz değildir ama biz elimizden gelenin en iyisini yapıyoruz."
        },
        {
          title: "7. Bilgileri ne kadar tutuyoruz?",
          content: "Sadece sana yardımcı olmak veya kurallara uymak için ihtiyacımız olduğu sürece. Bir şeylerin silinmesini mi istiyorsun? Sorman yeterli!"
        },
        {
          title: "8. Hakların (Kontrol sende!)",
          content: "Yaşadığın yere bağlı olarak şunları yapabilirsin:\n\nVerilerini görebilirsin.\nDüzeltilmesini veya silinmesini isteyebilirsin.\nBelirli kullanımlara \"hayır, teşekkürler\" diyebilirsin. Bize bir mesaj atman yeterli — yüzümüzde bir gülümsemeyle hemen çözeriz."
        },
        {
          title: "9. Bazen seyahat ediyoruz",
          content: "Verilerin başka ülkelerdeki sunucuları ziyaret edebilir ama her zaman sıkı gizlilik kurallarına uyduklarından emin oluruz."
        },
        {
          title: "10. Çocuklar için değil",
          content: "Uygulamamız sadece yetişkinler (18+) içindir. Çocuklardan bilgi toplamıyoruz."
        },
        {
          title: "11. Bu politikadaki güncellemeler",
          content: "Önemli bir şeyi değiştirirsek sana haber veririz. Uygulamayı kullanmaya devam etmen, yeni versiyonla \"okey\" olduğun anlamına gelir."
        },
        {
          title: "12. Sorular veya tatlı bir sohbet?",
          content: "Bize support@yumoyumo.com adresinden ulaşabilirsin. Senden haber almayı seviyoruz!"
        }
      ],
      closing: "Bize güvendiğin için teşekkürler. Para meselelerini daha az kafa karıştırıcı, daha çok ödüllendirici hale getirmek için buradayız — hem de gizliliğini sevgiyle koruyarak."
    },
    th: {
      title: "นโยบายความเป็นส่วนตัวของ Yumo Yumo (Privacy Policy)",
      lastUpdated: "อัปเดตล่าสุด: 19 ธันวาคม 2025",
      intro: "สวัสดีเพื่อนรัก! เราใส่ใจเรื่องความเป็นส่วนตัวของคุณมาก... แบบมากที่สุดเลยล่ะ นโยบายนี้จะอธิบายว่าเราดูแลข้อมูลของคุณอย่างไรด้วยวิธีที่นุ่มนวลที่สุดเท่าที่จะเป็นไปได้",
      sections: [
        {
          title: "1. ข้อมูลที่เราเก็บ (เฉพาะที่จำเป็นเท่านั้น)",
          content: "ที่อยู่กระเป๋าเงิน (Wallet Address): เมื่อคุณเชื่อมต่อ (ซึ่งเป็นข้อมูลสาธารณะบนบล็อกเชนอยู่แล้ว)\nใบเสร็จที่คุณอัปโหลด: เพื่อสร้างอินไซด์เจ๋งๆ ให้กับคุณ\nข้อมูลอุปกรณ์เบื้องต้น: เช่น รุ่นโทรศัพท์หรือเบราว์เซอร์ เพื่อให้แอปทำงานได้อย่างราบรื่น\nการแชท: หากคุณติดต่อสอบถามเราเข้ามา\nเราจะไม่เก็บข้อมูลที่ละเอียดอ่อน เว้นแต่ว่ามันจะติดมาในใบเสร็จโดยบังเอิญ (ดังนั้น โปรดอย่าแชร์ข้อมูลส่วนตัว เช่น ข้อมูลสุขภาพ ลงในใบเสร็จนะจ๊ะ!)"
        },
        {
          title: "2. เราใช้ข้อมูลของคุณอย่างไร",
          content: "เพื่อแสดงต้นทุนแฝงและสรุปยอดการใช้จ่ายสุดน่ารักของคุณ\nเพื่อคำนวณรางวัลที่คุณสมควรได้รับ\nเพื่อพัฒนาแอปให้ดีขึ้น (โดยใช้ข้อมูลที่ไม่ระบุตัวตนเท่านั้น — ไม่มีใครรู้ว่าเป็นคุณ!)\nเพื่อดูแลความปลอดภัยและความเรียบร้อยของระบบ"
        },
        {
          title: "3. การทำให้ไม่ระบุตัวตน (Anonymization) — มายากลชิ้นโปรดของเรา",
          content: "เวลาที่เราพัฒนาแอปหรือสร้างสถิติทั่วไป (เช่น \"ค่าอาหารในกรุงเทพฯ\") เราจะตัดข้อมูลทุกอย่างที่ระบุถึงตัวคุณออกไป ใบเสร็จของคุณจะช่วยสร้างประโยชน์ให้ทุกคนในขณะที่ยังคงความเป็นส่วนตัวของคุณไว้"
        },
        {
          title: "4. ใครจะเห็นข้อมูลของคุณบ้าง?",
          content: "แทบจะไม่มีใครเลย!\n\nผู้ช่วยที่เชื่อถือได้: (เช่น คลาวด์เซอร์วิส, ระบบวิเคราะห์) ซึ่งพวกเขาสัญญาว่าจะดูแลข้อมูลอย่างดี\nบล็อกเชน: (สำหรับเรื่องรางวัล) ส่วนนี้จะเป็นสาธารณะตามการออกแบบของระบบ\nกรณีที่กฎหมายขอข้อมูล: (ซึ่งเกิดขึ้นน้อยมากและน่าเบื่อสุดๆ)\nเราจะไม่ขายข้อมูลของคุณเด็ดขาด สัญญาด้วยเกียรติของ Yumbie เลย!"
        },
        {
          title: "5. บล็อกเชนนั้นคงอยู่ตลอดไป",
          content: "เมื่อรางวัลถูกส่งเข้าเชนแล้ว ข้อมูลเหล่านั้น (ที่อยู่กระเป๋าเงิน + จำนวนเงิน) จะเป็นสาธารณะ นั่นคือวิถีของ Web3 — โปร่งใสสุดๆ!"
        },
        {
          title: "6. การรักษาความปลอดภัย",
          content: "เราใช้ระบบล็อกที่แน่นหนาและมาตรการที่ระมัดระวังเพื่อปกป้องข้อมูลของคุณ ถึงแม้จะไม่มีอะไรในโลกที่กันเจาะได้ 100% แต่เราสัญญาว่าจะพยายามอย่างสุดความสามารถ"
        },
        {
          title: "7. เราเก็บข้อมูลไว้นานแค่ไหน",
          content: "เราเก็บไว้เฉพาะเท่าที่จำเป็นเพื่อช่วยเหลือคุณหรือทำตามกฎระเบียบเท่านั้น หากคุณต้องการลบข้อมูล? แค่บอกเรามาได้เลย!"
        },
        {
          title: "8. สิทธิ์ของคุณ (คุณคือผู้ควบคุม)",
          content: "คุณสามารถ:\n\nขอดูข้อมูลของคุณ\nแก้ไขหรือสั่งลบข้อมูล\nปฏิเสธการใช้งานในบางกรณี\nแค่ส่งข้อความหาเรา — เราจะจัดการให้พร้อมรอยยิ้มครับ"
        },
        {
          title: "9. การเดินทางของข้อมูล",
          content: "บางครั้งข้อมูลของคุณอาจต้องไปแวะเยี่ยมเซิร์ฟเวอร์ในประเทศอื่นๆ แต่เราจะตรวจสอบเสมอว่าที่นั่นมีกฎการคุ้มครองความเป็นส่วนตัวที่เข้มงวด"
        },
        {
          title: "10. เฉพาะผู้ใหญ่เท่านั้น",
          content: "แอปของเราออกแบบมาสำหรับผู้ที่มีอายุ 18 ปีขึ้นไปเท่านั้น เราไม่มีนโยบายเก็บข้อมูลจากเด็กครับ"
        },
        {
          title: "11. การอัปเดตนโยบาย",
          content: "หากมีการเปลี่ยนแปลงที่สำคัญ เราจะแจ้งให้คุณทราบ หากคุณยังใช้งานแอปต่อไป แสดงว่าคุณโอเคกับนโยบายเวอร์ชันใหม่แล้วนะ"
        },
        {
          title: "12. มีคำถามหรืออยากชวนคุยไหม?",
          content: "ติดต่อเราได้ที่ support@yumoyumo.com เราชอบที่จะได้ยินข่าวคราวจากคุณนะ!"
        }
      ],
      closing: "ขอบคุณที่ไว้วางใจเรา เรามาที่นี่เพื่อทำให้เรื่องเงินน่าสับสนน้อยลงและน่าตื่นเต้นมากขึ้น โดยที่ยังรักษาความเป็นส่วนตัวของคุณให้ปลอดภัยที่สุด กอดทีนึง!"
    },
    ru: {
      title: "Политика конфиденциальности Yumo Yumo",
      lastUpdated: "Последнее обновление: 19 декабря 2025 г.",
      intro: "Привет, друг! Мы очень заботимся о твоей приватности — правда, очень-очень. В этой политике мы максимально просто объясняем, как мы обращаемся с твоей информацией.",
      sections: [
        {
          title: "1. Что мы собираем (только самое необходимое)",
          content: "Адрес твоего кошелька (когда ты подключаешься — в блокчейне он и так публичен).\nЧеки, которые ты загружаешь (чтобы давать тебе те самые крутые инсайты).\nБазовые данные об устройстве (какой у тебя телефон или браузер), чтобы приложение работало без сбоев.\nПереписку, если ты решишь нам написать.\nМы не собираем ничего лишнего, если только это случайно не попадет в чек (пожалуйста, не делись личными данными, например, информацией о здоровье!)."
        },
        {
          title: "2. Как мы используем твою информацию",
          content: "Чтобы показывать тебе скрытые расходы и милую аналитику твоих трат.\nЧтобы рассчитывать твои заслуженные награды.\nЧтобы делать приложение лучше (используя только анонимизированные данные — никто не узнает, что это ты).\nЧтобы всё работало безопасно и стабильно."
        },
        {
          title: "3. Анонимизация — наш любимый магический трюк",
          content: "Когда мы улучшаем приложение или создаем общую статистику (например, «стоимость обедов в Бангкоке»), мы удаляем всё, что может указать на тебя лично. Твои чеки помогают всем, но остаются приватными."
        },
        {
          title: "4. Кто видит твою информацию?",
          content: "Почти никто!\n\nНадежные помощники (облачные сервисы, аналитика), которые обещали вести себя хорошо.\nБлокчейн (для наград — эта часть публична по определению).\nТолько если закон попросит (очень редко и скучно).\n\nМы никогда не продаем твои данные. Даем «розовое обещание»!"
        },
        {
          title: "5. Блокчейн — это навсегда",
          content: "Как только награды попадают в сеть, они становятся публичными (адрес кошелька + суммы). Так работает Web3 — полная прозрачность!"
        },
        {
          title: "6. Безопасность превыше всего",
          content: "Мы используем надежные замки и правильные привычки, чтобы защитить твою информацию. Ничто не защищено на 100%, но мы делаем всё возможное."
        },
        {
          title: "7. Как долго мы храним данные?",
          content: "Только до тех пор, пока они нужны нам, чтобы помогать тебе или соблюдать правила. Хочешь что-то удалить? Просто попроси!"
        },
        {
          title: "8. Твои права (всё под твоим контролем)",
          content: "В зависимости от того, где ты живешь, ты можешь:\n\nПосмотреть свои данные.\nИсправить или удалить их.\nСказать «нет, спасибо» некоторым видам использования.\nПросто напиши нам — мы всё решим с улыбкой."
        },
        {
          title: "9. Мы иногда путешествуем",
          content: "Твои данные могут храниться на серверах в других странах, но мы всегда следим за тем, чтобы там соблюдались строгие правила приватности."
        },
        {
          title: "10. Только для взрослых",
          content: "Наше приложение предназначено только для взрослых (18+). Мы не собираем информацию о детях."
        },
        {
          title: "11. Обновления политики",
          content: "Если мы изменим что-то важное, мы обязательно тебя предупредим. Продолжаешь пользоваться приложением — значит, ты согласен с новой версией."
        },
        {
          title: "12. Есть вопросы или просто хочешь поболтать?",
          content: "Пиши нам на info@yumoyumo.com. Мы обожаем получать весточки от тебя!"
        }
      ],
      closing: "Спасибо за доверие. Мы здесь, чтобы сделать финансовые штуки понятнее, а награды — приятнее, оберегая твой покой и приватность. Крепко обнимаем!"
    },
    es: {
      title: "Política de Privacidad de Yumo Yumo",
      lastUpdated: "Última actualización: 19 de diciembre de 2025",
      intro: "¡Hola, amigo! Tu privacidad nos importa muchísimo. Esta política explica cómo manejamos tu información de la manera más clara y transparente posible.",
      sections: [
        {
          title: "1. Lo que recopilamos (solo lo necesario)",
          content: "Tu dirección de billetera (cuando te conectas — es pública en blockchain de todos modos).\nRecibos que subes (para darte esos insights geniales).\nCosas básicas del dispositivo (como qué teléfono o navegador estás usando) para que la app funcione sin problemas.\nChats si nos contactas.\nNo agarramos cosas sensibles a menos que accidentalmente se cuelen en un recibo (¡por favor no compartas cosas como información de salud!)."
        },
        {
          title: "2. Cómo usamos tu información",
          content: "Para mostrarte los costos ocultos y tus estadísticas de gasto de forma adorable.\nPara calcular y entregarte tus recompensas $YUMO.\nPara mejorar la app usando datos anonimizados.\nPara mantener el ecosistema seguro y libre de bots."
        },
        {
          title: "3. Anonimización: Nuestro truco de magia favorito",
          content: "Cuando creamos estadísticas generales (como \"el costo de la vida en Madrid\"), eliminamos cualquier dato que pueda identificarte. Tus recibos ayudan a mejorar el sistema, pero tú permaneces en el anonimato."
        },
        {
          title: "4. ¿Quién ve tu información?",
          content: "¡Casi nadie!\n\nAyudantes confiables (servicios en la nube, análisis) que prometen ser buenos.\nBlockchain (para recompensas — esa parte es pública por diseño).\nSolo si la ley lo pide (muy raro y aburrido).\nNunca vendemos tus datos. Promesa de dedo meñique."
        },
        {
          title: "5. La Blockchain es para siempre",
          content: "Una vez que las recompensas se registran en la cadena, la transacción (wallet y monto) es pública y permanente. Así es la transparencia de la Web3."
        },
        {
          title: "6. Mantener las cosas seguras",
          content: "Usamos cerraduras fuertes y hábitos cuidadosos para proteger tu información. Nada es 100% inquebrantable, pero hacemos nuestro mejor esfuerzo."
        },
        {
          title: "7. Tiempo de conservación",
          content: "Solo guardamos tus datos el tiempo necesario para ofrecerte el servicio o cumplir con las normas. Si quieres que eliminemos algo, ¡solo pídelo!"
        },
        {
          title: "8. Tus derechos (tú tienes el control)",
          content: "Dependiendo de dónde vivas, puedes:\n\nVer tus datos\nCorregirlos o eliminarlos\nDecir \"no gracias\" a ciertos usos\nSolo escríbenos — lo resolveremos con una sonrisa."
        },
        {
          title: "9. Transferencias internacionales",
          content: "Tus datos podrían estar en servidores de otros países, pero siempre bajo estrictas normas de protección de privacidad."
        },
        {
          title: "10. No se permiten niños",
          content: "Nuestra app es solo para adultos (18+). No recopilamos información de niños."
        },
        {
          title: "11. Actualizaciones",
          content: "Si cambiamos algo importante, te avisaremos. Al seguir usando la app, aceptas la nueva versión de esta política."
        },
        {
          title: "12. ¿Preguntas o charlas acogedoras?",
          content: "Contáctanos en support@yumoyumo.com. ¡Nos encanta saber de ti!"
        }
      ],
      closing: "Gracias por confiar en nosotros. Estamos aquí para que las finanzas sean menos confusas y más gratificantes, protegiendo siempre tu privacidad. ¡Un gran abrazo!"
    },
    zh: {
      title: "Yumo Yumo 隐私政策",
      lastUpdated: "最后更新：2025 年 12 月 19 日",
      intro: "你好，朋友！你的隐私对我们来说非常重要。 这份隐私政策将向你说明，我们如何以温和、克制且负责任的方式 处理你的信息。",
      sections: [
        {
          title: "1. 我们收集哪些信息（只收必要的）",
          content: "我们只会收集为服务正常运行所必需的信息，包括：\n- 你的钱包地址（当你连接钱包时 —— 这是区块链上本就公开的信息）\n- 你上传的收据（用于提供消费洞察）\n- 基本设备信息（例如你使用的浏览器或设备类型，用于优化体验）\n- 当你联系我们时的沟通记录\n除非这些信息出现在收据中， 我们不会主动收集任何敏感数据 （也请尽量避免在收据中包含健康等敏感信息）。"
        },
        {
          title: "2. 我们如何使用这些信息",
          content: "我们使用这些信息来：\n- 展示价格结构与隐藏成本\n- 计算并发放你应得的奖励\n- 在匿名处理的前提下改进产品体验\n- 保障系统安全与稳定运行"
        },
        {
          title: "3. 匿名化处理（我们很擅长这个）",
          content: "当我们用于产品改进或生成整体统计数据时 （例如\"曼谷餐饮成本趋势\"）， 所有可识别个人的信息都会被移除。 你的收据可以帮助整个系统变得更聪明， 但它们不会暴露你是谁。"
        },
        {
          title: "4. 谁能看到你的信息？",
          content: "几乎没有人。\n\n- 值得信赖的服务提供方（如云服务、分析工具），且仅在必要范围内\n- 区块链网络（用于奖励发放，这部分是公开的）\n- 仅在法律要求的情况下\n我们不会出售你的数据。 这一点，我们是认真的。"
        },
        {
          title: "5. 关于区块链的透明性",
          content: "当奖励记录写入区块链后， 相关交易信息（钱包地址与数量）将公开可见。 这是 Web3 的基本特性， 透明但不可篡改。"
        },
        {
          title: "6. 数据安全",
          content: "我们采用合理的技术与管理措施 来保护你的信息安全。 没有任何系统是 100% 无风险的， 但我们始终尽最大努力降低风险。"
        },
        {
          title: "7. 数据保存时间",
          content: "我们只会在必要的时间内保留你的信息， 用于提供服务或满足合规要求。 如果你希望删除相关数据， 欢迎随时联系我们。"
        },
        {
          title: "8. 你的权利（你始终拥有控制权）",
          content: "根据你所在地区的法律， 你可能有权：\n\n- 查看你的数据\n- 更正或删除数据\n- 拒绝某些使用方式\n只需联系我们， 我们会认真处理你的请求。"
        },
        {
          title: "9. 数据的跨境存储",
          content: "你的数据可能会被存储在其他国家或地区的服务器上， 但我们始终确保这些服务遵守严格的隐私与安全标准。"
        },
        {
          title: "10. 未成年人说明",
          content: "Yumo Yumo 仅面向 18 岁及以上用户。 我们不会主动收集未成年人的信息。"
        },
        {
          title: "11. 政策更新",
          content: "如果本隐私政策发生重要变化， 我们会以合适的方式通知你。 继续使用服务， 即表示你接受更新后的版本。"
        },
        {
          title: "12. 有问题？想聊聊？",
          content: "欢迎随时联系我们： info@yumoyumo.com 感谢你对 Yumo Yumo 的信任。 我们希望让\"钱\"这件事更清晰、更有价值， 同时也让你的隐私得到妥善保护。"
        }
      ],
      closing: "感谢你对我们的信任。 我们希望让与金钱相关的事情变得更清晰、更有价值， 同时也会认真守护你的隐私与安全。"
    }
  };

  const content = privacyContent[locale] || privacyContent.en;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl p-8 md:p-12 border border-white/10">
            <div className="mb-8">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
                {content.title}
              </h1>
              <p className="text-sm text-gray-300 mb-6">
                {content.lastUpdated}
              </p>
              <div className="space-y-4 text-white leading-relaxed">
                <p className="text-lg text-gray-100">
                  {content.intro}
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {content.sections.map((section: any, index: number) => (
                <section key={index} className="border-b border-white/10 pb-6 last:border-b-0">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                    {section.title}
                  </h2>
                  <div className="text-gray-200 leading-relaxed space-y-3">
                    {section.content.split(/\n\n+/).map((paragraph: string, pIndex: number) => {
                      // Handle bullet points and single line breaks
                      const lines = paragraph.split('\n').filter(line => line.trim());
                      if (lines.length === 0) return null;
                      
                      // If it's a single line or starts with bullet, render as paragraph
                      if (lines.length === 1 || lines[0].trim().match(/^[•\-\d+\.]/)) {
                        return (
                          <p key={pIndex} className="mb-3 last:mb-0 whitespace-pre-line">
                            {paragraph}
                          </p>
                        );
                      }
                      
                      // Multiple lines - render each as separate paragraph
                      return (
                        <div key={pIndex} className="mb-3 last:mb-0 space-y-2">
                          {lines.map((line, lIndex) => (
                            <p key={lIndex} className="whitespace-pre-line">
                              {line}
                            </p>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-12 pt-8 border-t border-white/10">
              <p className="text-white text-lg leading-relaxed">
                {content.closing}
              </p>
              <p className="text-sm text-gray-300 mt-4">
                {content.lastUpdated}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
