"use client"

import React from "react";
import { useLocale } from "@/lib/i18n/context";

export default function TermsPage() {
  const { locale } = useLocale();

  const termsContent: Record<string, any> = {
    en: {
      title: "Terms & Conditions",
      lastUpdated: "Last Updated: December 19, 2025",
      intro: "Hey there! Welcome to Yumo Yumo — we're super happy you're here.",
      intro2: "These Terms are like the friendly rules of our little clubhouse. By using our app, website, or services (we call them all \"Services\"), you're saying \"okay!\" to these rules. If something doesn't feel right, no worries — just don't use the Services.",
      sections: [
        {
          title: "1. Who can join the fun?",
          content: "You need to be at least 18 (or the grown-up age where you live). We want everyone to be able to make their own choices responsibly."
        },
        {
          title: "2. Your account & wallet",
          content: "When you connect your Web3 wallet, keep it safe — it's like your house key! We're not responsible if someone else uses it without your permission. If something seems off, tell us right away."
        },
        {
          title: "3. What can you do here?",
          content: "Upload receipts, discover hidden costs with Proof of Expense (PoE), see cute spending insights, and earn aYUMO/rYUMO rewards that can turn into YUMO tokens. It's all about making everyday spending a bit more magical."
        },
        {
          title: "4. Receipts & your stuff",
          content: "When you upload receipts or other content, you're letting us use it (in a safe, anonymized way) to give you insights and make the app better for everyone. Promise us they're yours to share and don't break any rules or hurt anyone's feelings, okay?"
        },
        {
          title: "5. Rewards & YUMO tokens",
          content: "You earn aYUMO from real-life receipts and rYUMO from helping the community grow.\n\nThese can become YUMO tokens following clear, fair rules.\n\nYUMO is a utility token for fun stuff inside the app — not an investment or \"get rich quick\" ticket. Its value can go up and down, just like the crypto world.\n\nAny taxes on rewards? That's on you (sorry, adulting!)."
        },
        {
          title: "6. Please be kind (things we don't like)",
          content: "No fake receipts, no trying to game the system, no illegal stuff, no bullying, no hacking.\n\nIf something feels wrong, we might pause or say goodbye to your account — but we'd rather everyone plays nicely!"
        },
        {
          title: "7. Our stuff stays ours",
          content: "The app design, code, and ideas belong to us (or our friends who helped). You get to use them for personal fun, but no copying or selling, pretty please."
        },
        {
          title: "8. Privacy — we've got your back",
          content: "We take your privacy seriously (and cutely). Everything is explained in our Privacy Policy — give it a read with your favorite drink."
        },
        {
          title: "9. Third-party friends (wallets, blockchains)",
          content: "We team up with other tools (like wallets and blockchains). They're awesome, but we can't promise they'll always work perfectly. On-chain stuff is forever and public — that's just how blockchain rolls."
        },
        {
          title: "10. Heads up — no guarantees & NFA",
          content: "We do our best to make everything smooth and accurate, but:\n\nFriendly Guesses Only: Hidden cost estimates and spending insights are friendly guesses to help you learn. They are not financial, investment, or legal advice (NFA!). Always do your own research.\n\nServices are \"as is\": We try to be perfect, but we can't make \"perfect promises\" about everything working 100% of the time.\n\nCrypto Adventures: Crypto has ups and downs — you know the drill. Any moves you make are your own responsibility."
        },
        {
          title: "11. If something goes wrong",
          content: "We really hope nothing does, but if there's an issue, our responsibility is limited (to the max the law allows). We're not liable for indirect stuff — let's keep things positive!"
        },
        {
          title: "12. Crypto realities (the serious but honest part)",
          content: "Tokens can lose value, transactions can't be undone, and rules can change in different countries. YUMO is a utility token, not an investment ticket. Join the fun only if you're comfy with how blockchain rolls!"
        },
        {
          title: "13. Pausing or saying goodbye",
          content: "We might pause or close accounts if needed (we'll try to be fair). If that happens, unclaimed rewards might wave goodbye too."
        },
        {
          title: "14. The grown-up legal bit",
          content: "These Terms follow the laws of [e.g., England and Wales]. If we ever have a disagreement, we'll try chatting first. If needed, we'll use friendly arbitration in [e.g., Singapore]."
        },
        {
          title: "15. We might update these rules",
          content: "If we make changes, we'll let you know. Keep using the app = you're cool with the new version."
        },
        {
          title: "16. Want to chat?",
          content: "Questions, hugs, or high-fives? Reach us at info@yumoyumo.com."
        }
      ],
      closing: "Thanks for being part of Yumo Yumo — let's uncover the hidden and have fun doing it!"
    },
    tr: {
      title: "Yumo Yumo Kullanım Koşulları",
      lastUpdated: "Son Güncelleme: 19 Aralık 2025",
      intro: "Selam! Yumo Yumo'ya hoş geldin — burada olduğun için çok mutluyuz.",
      intro2: "Bu Koşullar, bizim küçük kulübümüzün arkadaşça kuralları gibidir. Uygulamamızı, web sitemizi veya hizmetlerimizi (hepsine birden \"Hizmetler\" diyoruz) kullanarak bu kurallara \"tamam!\" demiş oluyorsun. Eğer bir şeyler içine sinmiyorsa sorun değil; sadece Hizmetleri kullanmaman yeterli.",
      sections: [
        {
          title: "1. Eğlenceye kimler katılabilir?",
          content: "En az 18 yaşında (veya yaşadığın yerdeki reşitlik yaşında) olman gerekiyor. Herkesin kendi kararlarını sorumlulukla alabilmesini istiyoruz."
        },
        {
          title: "2. Hesabın ve Cüzdanın",
          content: "Web3 cüzdanını bağladığında onu güvenli tut; o senin evin anahtarı gibi! İznin olmadan başkası tarafından kullanılması durumunda sorumluluk kabul edemiyoruz. Eğer bir gariplik sezerden bize hemen haber ver."
        },
        {
          title: "3. Burada neler yapabilirsin?",
          content: "Fişlerini yükleyebilir, \"Harcama Kanıtı\" (PoE) ile gizli maliyetleri keşfedebilir, harcama içgörülerini görebilir ve YUMO token'lara dönüşebilen aYUMO/rYUMO ödülleri kazanabilirsin. Amacımız günlük harcamaları biraz daha \"sihirli\" hale getirmek!"
        },
        {
          title: "4. Fişler ve Senin Paylaştıkların",
          content: "Fişlerini veya içeriklerini yüklediğinde, sana içgörü sağlamak ve uygulamayı herkes için daha iyi hale getirmek adına bunları (güvenli ve anonim bir şekilde) kullanmamıza izin vermiş olursun. Paylaştığın şeylerin sana ait olduğuna ve kimsenin kalbini kırmayacağına dair bize söz ver, olur mu?"
        },
        {
          title: "5. Ödüller ve YUMO Token'lar",
          content: "Gerçek hayat fişlerinden aYUMO, topluluğun büyümesine yardım ederek rYUMO kazanırsın. Bunlar, net ve adil kurallar çerçevesinde YUMO token'a dönüşebilir.\n\nYUMO, uygulama içindeki havalı işler için bir \"fayda (utility) token'ıdır\" — bir yatırım aracı veya \"köşeyi dönme bileti\" değildir. Değeri, kripto dünyasında olduğu gibi inebilir veya çıkabilir.\n\nÖdüller üzerindeki vergiler mi? O konu sende (maalesef, yetişkin olmanın zorlukları!)."
        },
        {
          title: "6. Lütfen Nazik Ol (Sevmediğimiz Şeyler)",
          content: "Sahte fiş yok, sistemi kandırmaya çalışmak yok, yasa dışı işler yok, zorbalık yok, hacklemek yok.\n\nEğer bir şeyler yanlış hissettirirse hesabını durdurabilir veya sana veda edebiliriz — ama biz herkesin nazikçe oynamasını tercih ederiz!"
        },
        {
          title: "7. Bizimkiler Bizde Kalır",
          content: "Uygulama tasarımı, kodlar ve fikirler bize (veya bize yardım eden dostlarımıza) aittir. Bunları kişisel eğlencen için kullanabilirsin ama kopyalamak veya satmak yok, lütfen."
        },
        {
          title: "8. Gizlilik — Arkandayız!",
          content: "Gizliliğini ciddiye (ve tatlılıkla) alıyoruz. Her şey Gizlilik Politikamızda açıklandı — en sevdiğin içeceği yanına alıp bir göz at."
        },
        {
          title: "9. Üçüncü Taraf Dostlar (Cüzdanlar, Blockchainler)",
          content: "Cüzdanlar ve blockchain gibi diğer araçlarla ekip çalışması yapıyoruz. Onlar harikalar ama her zaman kusursuz çalışacaklarının sözünü veremeyiz. Zincir üstündeki (on-chain) her şey kalıcı ve halka açıktır — blockchain dünyası böyle yürür!"
        },
        {
          title: "10. Dikkat — Garanti Yok & Yatırım Tavsiyesi Değildir (NFA!)",
          content: "Her şeyi pürüzsüz ve doğru yapmak için elimizden geleni yapıyoruz ama:\n\nSadece Arkadaşça Tahminler: Gizli maliyet tahminleri ve harcama içgörüleri, öğrenmene yardımcı olacak arkadaşça tahminlerdir. Finansal, yatırım veya hukuk tavsiyesi değildir (NFA!). Her zaman kendi araştırmanı yap.\n\nHizmetler \"Olduğu Gibi\": Kusursuz olmaya çalışıyoruz ama her şeyin %100 her zaman çalışacağına dair \"kusursuz sözler\" veremeyiz.\n\nKripto Maceraları: Kriptonun iniş çıkışları vardır, bilirsin. Attığın her adım senin sorumluluğundadır."
        },
        {
          title: "11. Eğer Bir Şeyler Ters Giderse",
          content: "Umarız hiç olmaz ama bir sorun çıkarsa, sorumluluğumuz yasaların izin verdiği ölçüde sınırlıdır. Dolaylı durumlardan sorumlu değiliz — gelin ortamı pozitif tutalım!"
        },
        {
          title: "12. Kripto Gerçekleri (Ciddi Ama Dürüst Kısım)",
          content: "Tokenlar değer kaybedebilir, işlemler geri alınamaz ve ülkelerdeki kurallar değişebilir. YUMO bir yatırım bileti değil, bir fayda token'ıdır. Sadece blockchain dünyasının işleyişi seni rahat hissettiriyorsa eğlenceye katıl!"
        },
        {
          title: "13. Duraklatma veya Veda Etme",
          content: "Gerekirse hesapları durdurabilir veya kapatabiliriz (adil olmaya çalışacağız). Eğer bu olursa, talep edilmemiş ödüller de sana veda edebilir."
        },
        {
          title: "14. Yetişkinlerin Hukuk Bölümü",
          content: "Bu Koşullar [Örn: İngiltere ve Galler] yasalarına tabidir. Bir anlaşmazlık yaşarsak önce konuşmayı deneriz. Gerekirse [Örn: Singapur]'da arkadaşça bir tahkim yolu izleriz."
        },
        {
          title: "15. Bu Kuralları Güncelleyebiliriz",
          content: "Eğer değişiklik yaparsak sana haber veririz. Uygulamayı kullanmaya devam etmen, yeni versiyonla \"aran iyi\" demektir."
        },
        {
          title: "16. Sohbet Etmek İster misin?",
          content: "Biz çayı koyduk, gelirken çekirdek getirmeyi unutma. Bize info@yumoyumo.com adresinden ulaşabilirsin."
        }
      ],
      closing: "Yumo Yumo'nun bir parçası olduğun için teşekkürler — hadi gizli olanı açığa çıkaralım ve ortalığı karıştırarak biraz eğlenelim!"
    },
    th: {
      title: "ข้อตกลงและเงื่อนไขของ Yumo Yumo",
      lastUpdated: "อัปเดตล่าสุด: 19 ธันวาคม 2025",
      intro: "เย้! ยินดีต้อนรับสู่ Yumo Yumo นะ — เราดีใจสุดๆ เลยที่คุณมาอยู่ตรงนี้กับเรา",
      intro2: "ข้อตกลงเหล่านี้เปรียบเสมือน \"กฎที่เป็นมิตร\" ของคลับเฮาส์เล็กๆ ของเรา เพียงแค่คุณใช้งานแอป เว็บไซต์ หรือบริการของเรา (เราขอเรียกรวมๆ ว่า \"บริการ\") ก็เท่ากับคุณตกลงโอเคกับกฎเหล่านี้แล้ว แต่ถ้ามีอะไรที่รู้สึกว่าไม่ใช่ ก็ไม่เป็นไรนะ — แค่หยุดใช้งานบริการของเราก็พอแล้ว",
      sections: [
        {
          title: "1. ใครบ้างที่มาร่วมสนุกได้?",
          content: "คุณต้องมีอายุอย่างน้อย 18 ปี (หรือตามเกณฑ์อายุผู้ใหญ่ในที่ที่คุณอยู่) เราอยากให้ทุกคนสามารถตัดสินใจในสิ่งต่างๆ ได้ด้วยตัวเองอย่างมีความรับผิดชอบนะ"
        },
        {
          title: "2. บัญชีและกระเป๋าเงิน (Wallet) ของคุณ",
          content: "เมื่อคุณเชื่อมต่อกระเป๋าเงิน Web3 แล้ว โปรดดูแลมันให้ดีนะ — มันเหมือนกุญแจบ้านของคุณเลยล่ะ! เราจะไม่รับผิดชอบหากมีใครอื่นมาใช้งานโดยที่คุณไม่อนุญาต หากพบสิ่งผิดปกติ รีบบอกเราทันทีนะ"
        },
        {
          title: "3. คุณทำอะไรที่นี่ได้บ้าง?",
          content: "อัปโหลดใบเสร็จ ค้นหาต้นทุนแฝงผ่าน Proof of Expense (PoE) ดูข้อมูลการใช้จ่ายที่น่ารักๆ รับรางวัล aYUMO/rYUMO เพื่อเปลี่ยนเป็นโทเคน YUMO ในอนาคต เรามาเปลี่ยนการใช้จ่ายในทุกๆ วันให้ดูมหัศจรรย์ขึ้นกันเถอะ"
        },
        {
          title: "4. ใบเสร็จและสิ่งต่างๆ ของคุณ",
          content: "เมื่อคุณอัปโหลดใบเสร็จหรือเนื้อหาอื่นๆ คุณอนุญาตให้เราใช้งานข้อมูลเหล่านั้น (ในรูปแบบที่ปลอดภัยและไม่ระบุตัวตน) เพื่อมอบข้อมูลเชิงลึกและพัฒนาแอปให้ดีขึ้นสำหรับทุกคน สัญญาด้วยนะว่าสิ่งที่คุณแชร์เป็นของคุณจริงๆ และจะไม่ไปละเมิดกฎหรือทำร้ายความรู้สึกใครนะ โอเคไหม?"
        },
        {
          title: "5. รางวัลและโทเคน YUMO",
          content: "คุณจะได้รับ aYUMO จากใบเสร็จในชีวิตจริง และ rYUMO จากการช่วยให้คอมมูนิตี้เติบโต\n\nสิ่งเหล่านี้สามารถกลายเป็นโทเคน YUMO ได้ตามกฎที่โปร่งใสและยุติธรรม\n\nYUMO คือ Utility Token สำหรับใช้ทำกิจกรรมสนุกๆ ในแอป — ไม่ใช่เพื่อการลงทุนหรือตั๋ว \"รวยทางลัด\" นะ\n\nมูลค่าของมันขึ้นลงได้ตามโลกคริปโต\n\nเรื่องภาษีของรางวัลที่คุณได้รับ? คุณต้องเป็นคนดูแลเองนะ (ขอโทษด้วยนะ นี่แหละชีวิตผู้ใหญ่!)"
        },
        {
          title: "6. โปรดมีน้ำใจต่อกัน (สิ่งที่เราไม่ค่อยชอบ)",
          content: "ไม่ใช้ใบเสร็จปลอม ไม่โกงระบบ ไม่ทำเรื่องผิดกฎหมาย ไม่รังแกกัน และไม่แฮ็กระบบนะ\n\nหากมีอะไรผิดปกติ เราอาจจะพักการใช้งานหรือกล่าวคำอำลากับบัญชีของคุณ — แต่เราอยากให้ทุกคนเล่นกันอย่างน่ารักมากกว่า!"
        },
        {
          title: "7. ของๆ เราก็ยังเป็นของๆ เรา",
          content: "ดีไซน์ของแอป โค้ด และไอเดียต่างๆ เป็นของเรา (หรือเพื่อนๆ ที่ช่วยเราสร้างมันขึ้นมา) คุณสามารถใช้งานได้เพื่อความสนุกส่วนตัว แต่ห้ามคัดลอกหรือเอาไปขายนะจ๊ะ"
        },
        {
          title: "8. ความเป็นส่วนตัว — เราดูแลคุณเอง",
          content: "เราให้ความสำคัญกับความเป็นส่วนตัวของคุณอย่างมาก (และจัดการมันอย่างน่ารักด้วย) ทุกอย่างถูกอธิบายไว้ใน นโยบายความเป็นส่วนตัว (Privacy Policy) ของเรา — ลองไปอ่านดูพร้อมจิบเครื่องดื่มแก้วโปรดของคุณนะ"
        },
        {
          title: "9. เพื่อนจากบุคคลที่สาม (กระเป๋าเงิน, บล็อกเชน)",
          content: "เราทำงานร่วมกับเครื่องมืออื่นๆ อย่างกระเป๋าเงินและบล็อกเชน พวกเขาเก่งมาก แต่เราไม่สามารถสัญญาได้ว่าทุกอย่างจะทำงานสมบูรณ์แบบตลอดเวลา เรื่องที่เกิดขึ้นบน On-chain จะอยู่ตลอดไปและเป็นสาธารณะ — นั่นคือวิถีของบล็อกเชนล่ะ"
        },
        {
          title: "10. โปรดทราบ — ไม่มีการรับประกัน & NFA (ไม่ใช่คำแนะนำทางการเงิน)",
          content: "เป็นแค่การคาดเดาที่เป็นมิตร: ข้อมูลต้นทุนแฝงและข้อมูลการใช้จ่ายเป็นเพียงการคาดเดาที่เป็นมิตรเพื่อช่วยให้คุณได้เรียนรู้ ข้อมูลเหล่านี้ไม่ใช่คำแนะนำทางการเงิน การลงทุน หรือกฎหมาย (NFA!) อย่าลืมหาข้อมูลด้วยตัวเองเสมอ (DYOR)\n\nบริการเป็นแบบ \"ตามสภาพ\": เราพยายามทำให้ดีที่สุด แต่ไม่สามารถให้ \"สัญญาที่สมบูรณ์แบบ\" ว่าทุกอย่างจะทำงานได้ 100% ตลอดเวลา\n\nการผจญภัยในคริปโต: คริปโตมีขึ้นมีลง คุณก็น่าจะรู้ดี ทุกการตัดสินใจเป็นความรับผิดชอบของคุณเองนะ"
        },
        {
          title: "11. หากมีอะไรผิดพลาด",
          content: "เราหวังว่ามันจะไม่เกิดขึ้น แต่ถ้ามีปัญหา ความรับผิดชอบของเราจะมีจำกัด (ตามขอบเขตสูงสุดที่กฎหมายอนุญาต) เราไม่รับผิดชอบต่อความเสียหายทางอ้อม — มาช่วยกันทำให้ทุกอย่างเป็นบวกกันเถอะ!"
        },
        {
          title: "12. ความเป็นจริงของคริปโต (ส่วนที่จริงจังแต่จริงใจ)",
          content: "โทเคนสูญเสียมูลค่าได้ ธุรกรรมย้อนกลับไม่ได้ และกฎเกณฑ์ในแต่ละประเทศอาจเปลี่ยนไป YUMO คือ Utility Token ไม่ใช่ตั๋วสำหรับการลงทุน ร่วมสนุกกับเราเฉพาะตอนที่คุณรู้สึกโอเคกับวิถีของบล็อกเชนเท่านั้นนะ!"
        },
        {
          title: "13. การหยุดพักหรือการบอกลา",
          content: "เราอาจจะพักหรือปิดบัญชีหากจำเป็น (เราจะพยายามทำให้ยุติธรรมที่สุด) หากเกิดเหตุการณ์นั้น รางวัลที่ยังไม่ได้กดรับอาจจะบ๊ายบายตามไปด้วยนะ"
        },
        {
          title: "14. ส่วนที่เป็นกฎหมายแบบผู้ใหญ่",
          content: "ข้อตกลงเหล่านี้อยู่ภายใต้กฎหมายของ [เช่น อังกฤษและเวลส์] หากเรามีความเห็นไม่ตรงกัน เราจะลองคุยกันก่อน หากจำเป็น เราจะใช้วิธีอนุญาโตตุลาการที่เป็นมิตรใน [เช่น สิงคโปร์]"
        },
        {
          title: "15. เราอาจมีการอัปเดตกฎเหล่านี้",
          content: "หากมีการเปลี่ยนแปลง เราจะแจ้งให้คุณทราบ ถ้าคุณยังใช้แอปต่อ = คุณโอเคกับเวอร์ชันใหม่แล้วนะ"
        },
        {
          title: "16. อยากคุยกับเราไหม?",
          content: "มีคำถาม อยากกอด หรืออยากไฮไฟว์? ติดต่อเราได้ที่ support@yumoyumo.com (หรือ info@yumoyumo.com)"
        }
      ],
      closing: "ขอบคุณที่เป็นส่วนหนึ่งของ Yumo Yumo — มาเปิดเผยสิ่งที่ซ่อนอยู่และสนุกไปด้วยกันนะ!"
    },
    ru: {
      title: "Условия и положения Yumo Yumo",
      lastUpdated: "Последнее обновление: 19 декабря 2025 г.",
      intro: "Привет! Добро пожаловать в Yumo Yumo — мы очень рады, что ты с нами.",
      intro2: "Эти Условия — что-то вроде дружеских правил нашего маленького «клуба». Используя наше приложение, сайт или услуги (мы называем их просто \"Услуги\"), ты говоришь нам \"Окей!\", соглашаясь с этими правилами. Если что-то кажется тебе неподходящим — никаких обид, просто не используй Услуги.",
      sections: [
        {
          title: "1. Кто может присоединиться к веселью?",
          content: "Тебе должно быть не менее 18 лет (или ты должен достичь возраста совершеннолетия в твоей стране). Мы хотим, чтобы каждый принимал решения осознанно и ответственно."
        },
        {
          title: "2. Твой аккаунт и кошелек",
          content: "Когда ты подключаешь свой Web3-кошелек, береги его — это как ключ от твоего дома! Мы не несем ответственности, если кто-то другой воспользуется им без твоего разрешения. Если заметишь что-то странное — сразу дай нам знать."
        },
        {
          title: "3. Что здесь можно делать?",
          content: "Загружать чеки, открывать скрытые расходы с помощью Proof of Expense (PoE), получать милую аналитику своих трат и зарабатывать награды aYUMO/rYUMO, которые превращаются в токены YUMO. Наша цель — добавить капельку магии в твои ежедневные покупки."
        },
        {
          title: "4. Чеки и твой контент",
          content: "Загружая чеки или другой контент, ты разрешаешь нам использовать его (безопасным и анонимным способом), чтобы давать тебе инсайты и делать приложение лучше для всех. Обещай нам, что это твои данные, и они не нарушают ничьих прав, хорошо?"
        },
        {
          title: "5. Награды и токены YUMO",
          content: "Ты зарабатываешь aYUMO за реальные чеки и rYUMO за помощь в росте сообщества.\n\nОни превращаются в токены YUMO согласно честным и прозрачным правилам.\n\nYUMO — это утилитарный токен для классных штук внутри приложения, а не «билет к быстрому богатству» или инвестиция. Его цена может расти и падать, как и всё в крипто-мире.\n\nНалоги на награды? Это на твоей совести (увы, взрослая жизнь такая!)."
        },
        {
          title: "6. Пожалуйста, будь паинькой (что мы не любим)",
          content: "Никаких поддельных чеков, никаких попыток обмануть систему, никакого криминала, травли или хакинга. Если мы почувствуем неладное, мы можем приостановить работу твоего аккаунта — но мы верим, что все будут играть честно!"
        },
        {
          title: "7. Наше остается нашим",
          content: "Дизайн приложения, код и идеи принадлежат нам (или нашим друзьям, которые помогали). Ты можешь использовать их для личного удовольствия, но, пожалуйста, без копирования или продажи."
        },
        {
          title: "8. Приватность — мы за тебя горой",
          content: "Мы относимся к твоей конфиденциальности очень серьезно (и мило). Всё подробно описано в нашей Политике конфиденциальности — почитай её под любимый напиток."
        },
        {
          title: "9. Сторонние друзья (кошельки, блокчейны)",
          content: "Мы работаем в связке с другими инструментами. Они крутые, но мы не можем гарантировать, что они всегда будут работать идеально. Помни: всё, что попадает в блокчейн — публично и навсегда. Таков путь!"
        },
        {
          title: "10. Внимание: никаких гарантий и NFA",
          content: "Мы стараемся, чтобы всё было точно, но:\n\nТолько дружеские оценки: Данные о скрытых расходах — это обоснованные предположения для твоего саморазвития. Это не финансовый, инвестиционный или юридический совет (NFA!). Всегда проводи собственное исследование (DYOR).\n\nУслуги «как есть»: Мы стремимся к совершенству, но не можем обещать, что всё будет работать на 100% без сбоев.\n\nКрипто-приключения: В крипте бывают взлеты и падения. Любые твои действия — это твоя ответственность."
        },
        {
          title: "11. Если что-то пойдет не так",
          content: "Мы очень надеемся, что этого не случится, но в случае проблем наша ответственность ограничена (настолько, насколько позволяет закон). Давай сохранять позитив!"
        },
        {
          title: "12. Реалии крипто-мира",
          content: "Токены могут терять стоимость, транзакции нельзя отменить, а законы в разных странах могут меняться. YUMO — это токен для использования, а не для инвестиций. Присоединяйся, только если тебе комфортно с правилами блокчейна!"
        },
        {
          title: "13. Пауза или прощание",
          content: "Мы можем приостановить или закрыть аккаунты, если это необходимо (но постараемся быть справедливыми). В этом случае невостребованные награды могут «помахать ручкой»."
        },
        {
          title: "14. Юридические формальности",
          content: "Эти Условия регулируются законодательством [например, Англии и Уэльса]. Если у нас возникнут разногласия, сначала мы попробуем просто поговорить. Если не поможет — обратимся к дружественному арбитражу в [например, Сингапуре]."
        },
        {
          title: "15. Мы можем обновлять правила",
          content: "Если мы что-то изменим, мы дадим знать. Продолжаешь пользоваться приложением = ты согласен с новой версией."
        },
        {
          title: "16. Хочешь поболтать?",
          content: "Вопросы, объятия или «дай пять»? Пиши нам на info@yumoyumo.com."
        }
      ],
      closing: "Спасибо, что стали частью Yumo Yumo — давай раскрывать скрытое и получать от этого удовольствие!"
    },
    es: {
      title: "Términos y Condiciones de Yumo Yumo",
      lastUpdated: "Última actualización: 19 de diciembre de 2025",
      intro: "¡Hola! Bienvenido a Yumo Yumo. Estamos encantados de que formes parte de nuestra comunidad.",
      intro2: "Estos Términos son las reglas de convivencia de nuestro club. Al usar nuestros Servicios, aceptas estas normas. Si algo no te convence, no te preocupes, simplemente no utilices la plataforma.",
      sections: [
        {
          title: "1. ¿Quién puede unirse a la diversión?",
          content: "Debes tener al menos 18 años (veinte años en algunos países). Queremos que todos tomen decisiones responsables en nuestro ecosistema."
        },
        {
          title: "2. Tu cuenta y tu wallet",
          content: "Tu billetera Web3 es la llave de tu casa digital. Mantenla segura. No somos responsables si alguien la usa sin tu permiso. Si notas algo raro, avísanos de inmediato."
        },
        {
          title: "3. ¿Qué hacemos aquí?",
          content: "Sube tus recibos, descubre costos ocultos con Proof of Expense (PoE) y gana recompensas aYUMO/rYUMO que pueden convertirse en tokens $YUMO. Hacemos que tus gastos diarios tengan un toque de magia."
        },
        {
          title: "4. Tus datos y recibos",
          content: "Al subir contenido, nos permites usarlo de forma segura y anónima para mejorar la app y darte mejores estadísticas. Prométenos que los recibos son tuyos y que no rompes ninguna regla al compartirlos."
        },
        {
          title: "5. Recompensas y $YUMO",
          content: "Ganas aYUMO por vivir tu vida (recibos reales) y rYUMO por ayudar a la comunidad.\n\nNo es una inversión: $YUMO es un token de utilidad para divertirse en la app, no un boleto para \"hacerse rico rápido\".\n\nImpuestos: Declarar tus ganancias es tu responsabilidad (¡la vida adulta tiene estas cosas!)."
        },
        {
          title: "6. Reglas de convivencia (Lo que no nos gusta)",
          content: "Nada de recibos falsos, trampas al sistema, actividades ilegales o acoso. Si alguien juega sucio, tendremos que despedirnos de su cuenta. ¡Queremos buena vibra!"
        },
        {
          title: "7. Propiedad Intelectual",
          content: "El diseño, el código y las ideas de Yumo Yumo nos pertenecen. Puedes usarlos para tu diversión personal, pero por favor, no los copies ni los vendas."
        },
        {
          title: "8. Privacidad ante todo",
          content: "Cuidamos tus datos de forma adorable y profesional. Todo está explicado en nuestra Política de Privacidad. ¡Léela con un buen café!"
        },
        {
          title: "9. Aliados y Blockchain",
          content: "Usamos herramientas de terceros (wallets, redes blockchain). Son geniales, pero no podemos garantizar que funcionen al 100% siempre. Recuerda: en la blockchain, las transacciones son públicas y permanentes."
        },
        {
          title: "10. Aviso importante: Nada de esto es NFA",
          content: "Estimaciones amigables: Los cálculos de costos ocultos son aproximaciones para ayudarte a aprender. No son consejos financieros, legales o de inversión. Haz tu propia investigación (DYOR).\n\nServicios \"tal cual\": Intentamos que todo sea perfecto, pero no podemos prometer que la app funcionará sin errores el 100% del tiempo.\n\nMontaña rusa Crypto: El mundo cripto tiene altibajos. Cualquier movimiento que hagas es bajo tu propia responsabilidad."
        },
        {
          title: "11. Responsabilidad limitada",
          content: "Esperamos que todo vaya de maravilla, pero si surge algún problema, nuestra responsabilidad legal es limitada al máximo permitido por la ley."
        },
        {
          title: "12. Realidad Blockchain",
          content: "Los tokens pueden variar de valor y las transacciones no se pueden deshacer. Únete solo si te sientes cómodo con cómo funciona esta tecnología."
        },
        {
          title: "13. Despedidas",
          content: "Podemos pausar o cerrar cuentas si es necesario. Si eso ocurre, las recompensas no reclamadas podrían perderse. ¡Intentaremos ser siempre justos!"
        },
        {
          title: "14. Ley aplicable",
          content: "Estos términos se rigen por las leyes de [ej. Inglaterra y Gales]. Si hay un desacuerdo, intentaremos hablarlo primero como amigos."
        },
        {
          title: "15. Actualizaciones",
          content: "Si cambiamos las reglas, te avisaremos. Si sigues usando la app, significa que estás de acuerdo con la nueva versión."
        },
        {
          title: "16. ¿Charlamos?",
          content: "¿Dudas, abrazos o sugerencias? Escríbenos a info@yumoyumo.com."
        }
      ],
      closing: "¡Gracias por ser parte de Yumo Yumo! Vamos a descubrir lo oculto y a divertirnos."
    },
    zh: {
      title: "Yumo Yumo 使用条款",
      lastUpdated: "最后更新：2025 年 12 月 19 日",
      intro: "嗨！欢迎来到 Yumo Yumo —— 很高兴你在这里",
      intro2: "这些条款就像我们小小俱乐部里的友好规则。 当你使用我们的应用、网站或相关服务（以下统称为\"服务\"）， 就表示你同意这些规则。如果你觉得不太合适，也完全没关系， 只需停止使用服务即可。",
      sections: [
        {
          title: "1. 谁可以加入？",
          content: "你需要年满 18 岁（或你所在地区规定的法定成年年龄）。 我们希望每位用户都能在充分理解和自愿的情况下参与。"
        },
        {
          title: "2. 账户与钱包安全",
          content: "当你连接 Web3 钱包时，请像保管家门钥匙一样保护好它。如果他人在未经你允许的情况下使用了你的钱包，我们无法承担责任。 如果发现异常，请第一时间联系我们。"
        },
        {
          title: "3. 在这里可以做什么？",
          content: "你可以： - 上传收据 - 通过「支出证明（PoE）」了解价格结构 - 查看有趣又直观的消费洞察 - 获得 aYUMO / rYUMO 奖励，并在规则下转化为 YUMO 我们希望让日常消费变得更有意思一点"
        },
        {
          title: "4. 收据与内容归属",
          content: "当你上传收据或其他内容时， 你允许我们以**匿名、安全的方式**使用这些数据， 为你提供洞察，并持续优化产品体验。 请确认你有权分享这些内容， 并且它们不会违反任何法律或伤害他人。"
        },
        {
          title: "5. 奖励与 YUMO 代币",
          content: "• aYUMO 来自真实消费记录\n\n• rYUMO 来自对社区成长的支持\n\n它们可以按照清晰、公平的规则转化为 YUMO。\n\nYUMO 是应用内的功能型代币， 用于生态系统中的互动与服务， 不是投资产品，也不是\"快速致富\"的工具。 代币价值可能随市场波动而变化，这是加密世界的一部分。\n\n与奖励相关的任何税务责任， 需要你自行处理（成年人的小烦恼）。"
        },
        {
          title: "6. 我们不喜欢的事情",
          content: "请不要：\n\n• 上传虚假收据\n\n• 试图操纵系统\n\n• 进行任何违法行为\n\n• 骚扰、攻击他人\n\n• 破坏系统安全\n\n如果发现异常行为，我们可能会暂停或终止相关账户。 当然，我们更希望大家都能友好参与"
        },
        {
          title: "7. 知识产权",
          content: "应用的设计、代码与创意属于我们 （或帮助我们一起建设的合作伙伴）。 你可以个人使用，但请不要复制、出售或用于其他用途。"
        },
        {
          title: "8. 隐私保护",
          content: "你的隐私对我们来说很重要（而且是认真对待的那种）。 详细内容请查看我们的《隐私政策》， 找个喜欢的饮料，慢慢读一读"
        },
        {
          title: "9. 第三方服务（钱包、区块链）",
          content: "我们会与一些第三方工具合作， 例如钱包或区块链网络。 它们很棒，但我们无法保证始终完美运行。 链上操作是公开且不可撤销的， 这是区块链本身的特性。"
        },
        {
          title: "10. 温馨提醒（无保证 & 非建议）",
          content: "我们会尽力让服务稳定、准确，但请注意：\n\n友好估算： 隐藏成本与消费洞察仅用于帮助理解， 不构成任何财务、投资或法律建议。\n\n服务现状提供： 服务按\"现状\"提供，我们无法保证始终 100% 无误。\n\n加密世界的起伏： 加密资产存在波动，所有操作需自行承担责任"
        },
        {
          title: "11. 如果出现问题",
          content: "我们当然希望一切顺利。 如发生问题，我们的责任将限制在法律允许的最大范围内， 不对间接损失承担责任。 让我们尽量保持轻松与善意"
        },
        {
          title: "12. 关于加密世界的现实",
          content: "代币可能贬值， 交易无法撤回， 不同地区的规则也可能发生变化。 YUMO 是功能型代币，而非投资凭证。 请在你了解并接受区块链特性的前提下参与"
        },
        {
          title: "13. 暂停或终止服务",
          content: "在必要情况下，我们可能暂停或关闭账户， 并会尽量公平处理。 若账户终止，未领取的奖励可能无法继续获取。"
        },
        {
          title: "14. 法律适用",
          content: "本条款受【例如：英格兰与威尔士】法律管辖。 如发生争议，我们会优先沟通解决； 如有需要，将通过【例如：新加坡】的仲裁方式处理。"
        },
        {
          title: "15. 条款更新",
          content: "我们可能会不时更新这些条款。 继续使用服务，表示你接受更新后的版本。"
        },
        {
          title: "16. 联系我们",
          content: "有问题、想聊天、或只是打个招呼？ 欢迎联系：info@yumoyumo.com"
        }
      ],
      closing: "感谢你成为 Yumo Yumo 的一部分， 让我们一起发现隐藏的价值，并享受这个过程"
    }
  };

  const content = termsContent[locale] || termsContent.en;

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
              <div className="space-y-3 text-white leading-relaxed">
                <p className="text-lg text-gray-100">
                  {content.intro}
                </p>
                <p className="text-gray-200">
                  {content.intro2}
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {content.sections.map((section: any, index: number) => (
                <section key={index} className="border-b border-white/10 pb-6 last:border-b-0">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                    {section.title}
                  </h2>
                  <div className="text-gray-200 leading-relaxed whitespace-pre-line space-y-3">
                    {section.content.split('\n\n').map((paragraph: string, pIndex: number) => (
                      <p key={pIndex} className="mb-3 last:mb-0">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-12">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 md:p-12 relative overflow-hidden border border-white/10">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-pink-500 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-pink-500 to-primary"></div>
                <div className="text-center">
                  <p className="text-white text-lg md:text-xl leading-relaxed font-medium">
                    {content.closing}
                  </p>
                  <p className="text-sm text-gray-300 mt-6">
                    {content.lastUpdated}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
