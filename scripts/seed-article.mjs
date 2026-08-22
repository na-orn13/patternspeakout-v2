// Seed the example CEFR-annotated article "The Future of Work".
// Usage: node scripts/seed-article.mjs
// Requires env: SEED_URL (deployed base url) and ADMIN_SECRET.

const BASE = process.env.SEED_URL || "https://patternspeakout.vercel.app";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_SECRET) {
  console.error("ADMIN_SECRET env var is required.");
  process.exit(1);
}

const article = {
  isArticle: true,
  category: "articles",
  idiom: "The Future of Work in a Digital World: Automation, Innovation, and New Careers",
  cefr: "B2",
  partOfSpeech: "article",
  articleCategory: "Technology & Society",
  author: "Pattern SpeakOut Editorial",
  source: "Original content — Pattern SpeakOut",
  readingTime: "6 min",
  date: new Date().toISOString().split("T")[0],
  thumbnail: "🤖",
  definitionEN: "How automation and AI are reshaping work — and why human creativity, adaptability, and collaboration matter more than ever.",
  definitionTH: "ระบบอัตโนมัติและ AI กำลังเปลี่ยนโลกของการทำงานอย่างไร และทำไมความคิดสร้างสรรค์ การปรับตัว และการทำงานร่วมกันของมนุษย์จึงสำคัญยิ่งกว่าที่เคย",
  bodyEN: [
    "The world of work is changing faster than ever. Artificial intelligence can analyse information in seconds, robots can perform repetitive or dangerous tasks, and automation can complete work that once required hours of human effort.",
    "This raises an important question: Will machines take our jobs?",
    "The answer is complicated. Some occupations may disappear, while others will change significantly. However, throughout history, technology has not only replaced certain kinds of work—it has also created new opportunities.",
    "Twenty years ago, careers such as social media manager, app developer, and AI specialist were new or barely existed. Today, these professionals play important roles in society. As technology continues to develop, we may see new careers in artificial intelligence, robotics, cybersecurity, virtual reality, and fields we cannot yet imagine.",
    "This is where innovation becomes essential. Innovation is not simply about inventing the newest machine or developing the most advanced software. It is about recognising a problem and asking, “How can we solve this differently?”",
    "A new technology can create an entire industry. A simple idea can become a global business, and one person’s creativity can change how millions of people live and work.",
    "Preparing for the future does not mean predicting every new occupation. It means developing the skills that enable us to adapt to whatever comes next.",
    "Technology may be powerful, but some human abilities are difficult to replace. A machine can process information, but it cannot truly experience empathy. An algorithm can identify patterns, but it cannot dream. Technology can generate suggestions, but humans give those ideas purpose and meaning.",
    "For this reason, the future of work should not be viewed as humans versus machines. It should be about humans working with machines.",
    "Imagine a doctor using AI to detect diseases earlier, an engineer using robots in dangerous environments, or a police officer using digital tools to investigate crime. In these situations, technology does not replace people. It helps them perform their work more safely and effectively.",
    "Nevertheless, this future presents serious challenges. Not everyone has equal access to technology. As AI becomes more powerful, society must think carefully about privacy, responsibility, fairness, and the effects of automation on workers.",
    "The future of work is therefore not only a technological challenge; it is also a human one.",
    "We must ensure that innovation benefits people, not only businesses. Workers need opportunities to develop new skills, and progress should be measured not merely by how advanced technology becomes, but by how much it improves people’s lives.",
    "For students preparing to enter this rapidly changing world, the greatest advantage is not knowing everything. It is knowing how to learn, adapt, collaborate, and create.",
    "We should not be afraid of a future we cannot predict. The future of work is something we will help create. We can choose to innovate responsibly and build a world in which humans and machines work together rather than against each other.",
    "The most useful question may not be, “What jobs will technology leave for us?”",
    "Instead, we should ask, “What future will we create with technology?”",
    "The future is uncertain, but that is exactly what makes it exciting. The future has not yet been written—and we are the ones holding the pen.",
  ],
  bodyTH: [
    "โลกของการทำงานกำลังเปลี่ยนแปลงเร็วกว่าที่เคย ปัญญาประดิษฐ์สามารถวิเคราะห์ข้อมูลได้ในไม่กี่วินาที หุ่นยนต์สามารถทำงานที่ซ้ำซากหรืออันตรายได้ และระบบอัตโนมัติสามารถทำงานที่ครั้งหนึ่งเคยต้องใช้เวลาหลายชั่วโมงของมนุษย์ให้เสร็จได้",
    "สิ่งนี้ทำให้เกิดคำถามสำคัญว่า เครื่องจักรจะมาแย่งงานของเราหรือไม่?",
    "คำตอบนั้นซับซ้อน บางอาชีพอาจหายไป ในขณะที่อาชีพอื่นจะเปลี่ยนแปลงไปอย่างมาก อย่างไรก็ตาม ตลอดประวัติศาสตร์ เทคโนโลยีไม่ได้เพียงแค่แทนที่งานบางประเภทเท่านั้น แต่ยังสร้างโอกาสใหม่ๆ ขึ้นมาด้วย",
    "เมื่อยี่สิบปีก่อน อาชีพอย่างผู้จัดการโซเชียลมีเดีย นักพัฒนาแอป และผู้เชี่ยวชาญด้าน AI ยังใหม่มากหรือแทบไม่มีอยู่เลย ทุกวันนี้ ผู้เชี่ยวชาญเหล่านี้มีบทบาทสำคัญในสังคม เมื่อเทคโนโลยียังคงพัฒนาต่อไป เราอาจได้เห็นอาชีพใหม่ๆ ในด้านปัญญาประดิษฐ์ วิทยาการหุ่นยนต์ ความมั่นคงปลอดภัยไซเบอร์ ความเป็นจริงเสมือน และในสาขาที่เรายังนึกภาพไม่ออก",
    "นี่คือจุดที่นวัตกรรมกลายเป็นสิ่งจำเป็น นวัตกรรมไม่ได้เป็นเพียงการประดิษฐ์เครื่องจักรที่ใหม่ที่สุดหรือการพัฒนาซอฟต์แวร์ที่ล้ำสมัยที่สุด แต่มันคือการมองเห็นปัญหาแล้วตั้งคำถามว่า “เราจะแก้ปัญหานี้ด้วยวิธีที่ต่างออกไปได้อย่างไร?”",
    "เทคโนโลยีใหม่หนึ่งอย่างสามารถสร้างอุตสาหกรรมทั้งอุตสาหกรรมได้ ไอเดียง่ายๆ หนึ่งอย่างสามารถกลายเป็นธุรกิจระดับโลก และความคิดสร้างสรรค์ของคนเพียงคนเดียวสามารถเปลี่ยนวิถีชีวิตและการทำงานของคนนับล้านได้",
    "การเตรียมพร้อมสำหรับอนาคตไม่ได้หมายถึงการทำนายทุกอาชีพใหม่ แต่หมายถึงการพัฒนาทักษะที่ทำให้เราสามารถปรับตัวเข้ากับสิ่งใดก็ตามที่จะเกิดขึ้นต่อไป",
    "เทคโนโลยีอาจทรงพลัง แต่ความสามารถบางอย่างของมนุษย์นั้นยากที่จะแทนที่ เครื่องจักรสามารถประมวลผลข้อมูลได้ แต่ไม่สามารถสัมผัสถึงความเห็นอกเห็นใจได้อย่างแท้จริง อัลกอริทึมสามารถระบุรูปแบบได้ แต่ไม่สามารถฝันได้ เทคโนโลยีสามารถสร้างข้อเสนอแนะได้ แต่มนุษย์ต่างหากที่มอบเป้าหมายและความหมายให้กับไอเดียเหล่านั้น",
    "ด้วยเหตุนี้ อนาคตของการทำงานจึงไม่ควรถูกมองว่าเป็นมนุษย์ต่อสู้กับเครื่องจักร แต่ควรเป็นเรื่องของมนุษย์ที่ทำงานร่วมกับเครื่องจักร",
    "ลองนึกภาพแพทย์ที่ใช้ AI เพื่อตรวจพบโรคได้เร็วขึ้น วิศวกรที่ใช้หุ่นยนต์ในสภาพแวดล้อมที่อันตราย หรือตำรวจที่ใช้เครื่องมือดิจิทัลเพื่อสืบสวนอาชญากรรม ในสถานการณ์เหล่านี้ เทคโนโลยีไม่ได้มาแทนที่ผู้คน แต่ช่วยให้พวกเขาทำงานได้อย่างปลอดภัยและมีประสิทธิภาพมากขึ้น",
    "อย่างไรก็ตาม อนาคตนี้ก็มาพร้อมกับความท้าทายที่ร้ายแรง ไม่ใช่ทุกคนที่มีโอกาสเข้าถึงเทคโนโลยีอย่างเท่าเทียมกัน เมื่อ AI ทรงพลังมากขึ้น สังคมต้องคิดอย่างรอบคอบเกี่ยวกับความเป็นส่วนตัว ความรับผิดชอบ ความเป็นธรรม และผลกระทบของระบบอัตโนมัติต่อแรงงาน",
    "ดังนั้น อนาคตของการทำงานจึงไม่ใช่เพียงความท้าทายทางเทคโนโลยีเท่านั้น แต่ยังเป็นความท้าทายของมนุษย์ด้วย",
    "เราต้องทำให้แน่ใจว่านวัตกรรมเป็นประโยชน์ต่อผู้คน ไม่ใช่แค่ต่อธุรกิจเท่านั้น แรงงานต้องการโอกาสในการพัฒนาทักษะใหม่ๆ และความก้าวหน้าควรถูกวัดไม่ใช่เพียงจากความล้ำสมัยของเทคโนโลยี แต่จากการที่มันช่วยพัฒนาชีวิตของผู้คนได้มากเพียงใด",
    "สำหรับนักเรียนที่กำลังเตรียมตัวก้าวเข้าสู่โลกที่เปลี่ยนแปลงอย่างรวดเร็วนี้ ข้อได้เปรียบที่ยิ่งใหญ่ที่สุดไม่ใช่การรู้ทุกอย่าง แต่คือการรู้วิธีเรียนรู้ ปรับตัว ทำงานร่วมกัน และสร้างสรรค์",
    "เราไม่ควรกลัวอนาคตที่เราไม่สามารถทำนายได้ อนาคตของการทำงานเป็นสิ่งที่เราจะร่วมกันสร้างขึ้น เราสามารถเลือกที่จะสร้างนวัตกรรมอย่างมีความรับผิดชอบ และสร้างโลกที่มนุษย์และเครื่องจักรทำงานร่วมกัน แทนที่จะต่อสู้กัน",
    "คำถามที่มีประโยชน์ที่สุดอาจไม่ใช่ “เทคโนโลยีจะเหลืองานอะไรไว้ให้เราบ้าง?”",
    "แต่เราควรถามว่า “เราจะสร้างอนาคตแบบใดขึ้นมาด้วยเทคโนโลยี?”",
    "อนาคตนั้นไม่แน่นอน แต่นั่นแหละคือสิ่งที่ทำให้มันน่าตื่นเต้น อนาคตยังไม่ถูกเขียนขึ้น และเราคือผู้ที่ถือปากกาอยู่",
  ],
  vocabulary: [
    { phrase: "Artificial intelligence", headword: "artificial intelligence", cefr: "B2", pos: "noun phrase", meaningEN: "Computer systems able to perform tasks that normally require human intelligence.", meaningTH: "ปัญญาประดิษฐ์ — ระบบคอมพิวเตอร์ที่ทำงานซึ่งปกติต้องใช้สติปัญญาของมนุษย์", exampleEN: "Artificial intelligence can analyse data in seconds.", exampleTH: "ปัญญาประดิษฐ์สามารถวิเคราะห์ข้อมูลได้ในไม่กี่วินาที" },
    { phrase: "analyse", headword: "analyse", cefr: "B1", pos: "verb", meaningEN: "To examine something in detail to understand it.", meaningTH: "วิเคราะห์ — ตรวจสอบอย่างละเอียดเพื่อทำความเข้าใจ", exampleEN: "AI can analyse information in seconds.", exampleTH: "AI สามารถวิเคราะห์ข้อมูลได้ในไม่กี่วินาที" },
    { phrase: "repetitive", headword: "repetitive", cefr: "B2", pos: "adjective", meaningEN: "Involving doing the same thing many times, often boringly.", meaningTH: "ซ้ำซาก — ทำสิ่งเดิมซ้ำๆ หลายครั้ง", exampleEN: "Robots can perform repetitive tasks tirelessly.", exampleTH: "หุ่นยนต์สามารถทำงานที่ซ้ำซากได้โดยไม่เหนื่อย" },
    { phrase: "automation", headword: "automation", cefr: "B2", pos: "noun", meaningEN: "The use of machines to do work that people used to do.", meaningTH: "ระบบอัตโนมัติ — การใช้เครื่องจักรทำงานแทนคน", exampleEN: "Automation can complete work in minutes.", exampleTH: "ระบบอัตโนมัติทำงานเสร็จได้ในไม่กี่นาที" },
    { phrase: "occupations", headword: "occupation", cefr: "B1", pos: "noun", meaningEN: "A job or profession.", meaningTH: "อาชีพ — งานหรือวิชาชีพ", exampleEN: "Some occupations may disappear in the future.", exampleTH: "บางอาชีพอาจหายไปในอนาคต" },
    { phrase: "cybersecurity", headword: "cybersecurity", cefr: "C1", pos: "noun", meaningEN: "Protection of computer systems from digital attacks.", meaningTH: "ความมั่นคงปลอดภัยไซเบอร์ — การปกป้องระบบคอมพิวเตอร์จากการโจมตี", exampleEN: "Cybersecurity is a growing career field.", exampleTH: "ความมั่นคงปลอดภัยไซเบอร์เป็นสายอาชีพที่กำลังเติบโต" },
    { phrase: "innovation", headword: "innovation", cefr: "B2", pos: "noun", meaningEN: "A new idea, method, or product; the act of creating one.", meaningTH: "นวัตกรรม — ไอเดีย วิธีการ หรือผลิตภัณฑ์ใหม่", exampleEN: "This is where innovation becomes essential.", exampleTH: "นี่คือจุดที่นวัตกรรมกลายเป็นสิ่งจำเป็น" },
    { phrase: "adapt", headword: "adapt", cefr: "B1", pos: "verb", meaningEN: "To change in order to deal with a new situation.", meaningTH: "ปรับตัว — เปลี่ยนแปลงเพื่อรับมือกับสถานการณ์ใหม่", exampleEN: "We must develop skills that help us adapt.", exampleTH: "เราต้องพัฒนาทักษะที่ช่วยให้เราปรับตัวได้" },
    { phrase: "empathy", headword: "empathy", cefr: "C1", pos: "noun", meaningEN: "The ability to understand and share another person’s feelings.", meaningTH: "ความเห็นอกเห็นใจ — ความสามารถในการเข้าใจและรู้สึกร่วมกับผู้อื่น", exampleEN: "A machine cannot truly experience empathy.", exampleTH: "เครื่องจักรไม่สามารถสัมผัสความเห็นอกเห็นใจได้อย่างแท้จริง" },
    { phrase: "algorithm", headword: "algorithm", cefr: "C1", pos: "noun", meaningEN: "A set of steps a computer follows to solve a problem.", meaningTH: "อัลกอริทึม — ชุดขั้นตอนที่คอมพิวเตอร์ใช้แก้ปัญหา", exampleEN: "An algorithm can identify patterns, but it cannot dream.", exampleTH: "อัลกอริทึมระบุรูปแบบได้ แต่ฝันไม่ได้" },
    { phrase: "privacy", headword: "privacy", cefr: "B2", pos: "noun", meaningEN: "The state of being free from public attention or having personal information kept secret.", meaningTH: "ความเป็นส่วนตัว — การไม่ถูกเปิดเผยข้อมูลส่วนบุคคล", exampleEN: "Society must think carefully about privacy.", exampleTH: "สังคมต้องคิดอย่างรอบคอบเกี่ยวกับความเป็นส่วนตัว" },
    { phrase: "responsibility", headword: "responsibility", cefr: "B1", pos: "noun", meaningEN: "A duty to deal with or take care of something.", meaningTH: "ความรับผิดชอบ — หน้าที่ในการดูแลหรือจัดการบางสิ่ง", exampleEN: "We must think about responsibility and fairness.", exampleTH: "เราต้องคำนึงถึงความรับผิดชอบและความเป็นธรรม" },
    { phrase: "collaborate", headword: "collaborate", cefr: "B2", pos: "verb", meaningEN: "To work together with others to achieve something.", meaningTH: "ทำงานร่วมกัน — ร่วมมือกับผู้อื่นเพื่อบรรลุเป้าหมาย", exampleEN: "It is knowing how to learn, adapt, collaborate, and create.", exampleTH: "คือการรู้วิธีเรียนรู้ ปรับตัว ทำงานร่วมกัน และสร้างสรรค์" },
    { phrase: "uncertain", headword: "uncertain", cefr: "B2", pos: "adjective", meaningEN: "Not known, not fixed, or not reliable.", meaningTH: "ไม่แน่นอน — ยังไม่รู้แน่ชัดหรือไม่คงที่", exampleEN: "The future is uncertain, but that makes it exciting.", exampleTH: "อนาคตไม่แน่นอน แต่นั่นทำให้มันน่าตื่นเต้น" },
  ],
  synonyms: [],
  antonyms: [],
  keyWords: [],
  examples: [],
  usage: "",
  context: "",
};

const res = await fetch(`${BASE}/api/idioms/add`, {
  method: "POST",
  headers: { Authorization: `Bearer ${ADMIN_SECRET}`, "Content-Type": "application/json" },
  body: JSON.stringify(article),
});
const data = await res.json();
console.log(res.status, data);
if (!res.ok) process.exit(1);
