// 139 unique dhikr phrases — { ar, en, ur, fr, es, id, de }

const TASBIH_PHRASES = [
    // Basic tasbih (15)
    {
        ar: "سُبْحَانَ اللَّهِ",
        en: "Subhan Allah",
        ur: "سبحان اللہ",
        fr: "Gloire à Allah",
        id: "Subhanallah",
        de: "Gepriesen sei Allah",
        es: "Gloria a Allah"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ",
        en: "Alhamdulillah",
        ur: "الحمد للہ",
        fr: "Louange à Allah",
        id: "Alhamdulillah",
        de: "Alhamdulillah",
        es: "Alabado sea Allah"
    },
    {
        ar: "اللَّهُ أَكْبَرُ",
        en: "Allahu Akbar",
        ur: "اللہ اکبر",
        fr: "Allah est le Plus Grand",
        id: "Allahu Akbar",
        de: "Allahu Akbar",
        es: "Allah es el Más Grande"
    },
    {
        ar: "لَا إِلَٰهَ إِلَّا اللَّهُ",
        en: "La ilaha illallah",
        ur: "لا الٰہ الا اللہ",
        fr: "Il n'y a de divinité qu'Allah",
        id: "La ilaha illallah",
        de: "La ilaha illallah",
        es: "No hay divinidad salvo Allah"
    },
    {
        ar: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
        en: "La hawla wa la quwwata illa billah",
        ur: "لا حول ولا قوۃ الا باللہ",
        fr: "Il n'y a de force ni de puissance qu'en Allah",
        id: "La hawla wa la quwwata illa billah",
        de: "La hawla wa la quwwata illa billah",
        es: "No hay fuerza ni poder sino en Allah"
    },
    {
        ar: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ",
        en: "Allahumma salli ala Muhammad",
        ur: "اللہم صل علیٰ محمد",
        fr: "Ô Allah, accorde Tes prières à Muhammad",
        id: "Ya Allah, limpahkanlah shalawat kepada Muhammad",
        de: "O Allah, segne Muhammad",
        es: "Oh Allah, concede Tus bendiciones a Muhammad"
    },
    {
        ar: "اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ",
        en: "Allahumma barik ala Muhammad",
        ur: "اللہم بارک علیٰ محمد",
        fr: "Ô Allah, bénis Muhammad",
        id: "Ya Allah, berkahilah Muhammad",
        de: "O Allah, segne Muhammad mit Segen",
        es: "Oh Allah, bendice a Muhammad"
    },
    {
        ar: "صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ",
        en: "Sallallahu alayhi wa sallam",
        ur: "صلی اللہ علیہ وسلم",
        fr: "Que la paix et les bénédictions d'Allah soient sur lui",
        id: "Shalawat dan salam Allah atas beliau",
        de: "Allahs Segen und Frieden sei mit ihm",
        es: "Que la paz y las bendiciones de Allah sean con él"
    },
    {
        ar: "بِسْمِ اللَّهِ",
        en: "Bismillah",
        ur: "بسم اللہ",
        fr: "Au nom d'Allah",
        id: "Bismillah",
        de: "Bismillah",
        es: "En el nombre de Allah"
    },
    {
        ar: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        en: "Bismillah ar-Rahman ar-Raheem",
        ur: "بسم اللہ الرحمٰن الرحیم",
        fr: "Au nom d'Allah, le Tout Miséricordieux, le Très Miséricordieux",
        id: "Bismillahirrahmanirrahim",
        de: "Im Namen Allahs, des Allerbarmers, des Barmherzigen",
        es: "En el nombre de Allah, el Compasivo, el Misericordioso"
    },
    {
        ar: "اللَّهُمَّ آمِينَ",
        en: "Allahumma Ameen",
        ur: "اللہم آمین",
        fr: "Ô Allah, exauce",
        id: "Ya Allah, kabulkanlah",
        de: "O Allah, erhöre uns",
        es: "Oh Allah, acepta nuestra súplica"
    },
    {
        ar: "يَا اللَّهُ",
        en: "Ya Allah",
        ur: "یا اللہ",
        fr: "Ô Allah",
        id: "Ya Allah",
        de: "O Allah",
        es: "Oh Allah"
    },
    {
        ar: "يَا رَبِّ",
        en: "Ya Rabb",
        ur: "یا رب",
        fr: "Ô Seigneur",
        id: "Ya Rabb",
        de: "O Herr",
        es: "Oh Señor"
    },
    {
        ar: "يَا رَحْمَٰنُ",
        en: "Ya Rahman",
        ur: "یا رحمٰن",
        fr: "Ô Tout Miséricordieux",
        id: "Ya Ar-Rahman",
        de: "O Allerbarmer",
        es: "Oh Misericordioso"
    },
    {
        ar: "يَا رَحِيمُ",
        en: "Ya Raheem",
        ur: "یا رحیم",
        fr: "Ô Très Miséricordieux",
        id: "Ya Ar-Rahim",
        de: "O Barmherziger",
        es: "Oh Muy Misericordioso"
    },

    // Compound tasbih (20)
    {
        ar: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
        en: "Subhan Allah wa bihamdihi",
        ur: "سبحان اللہ وبحمدہ",
        fr: "Gloire à Allah et louange à Lui",
        id: "Subhanallah wa bihamdihi",
        de: "Gepriesen sei Allah und gelobt sei Er",
        es: "Gloria a Allah y alabanza a Él"
    },
    {
        ar: "سُبْحَانَ اللَّهِ الْعَظِيمِ",
        en: "Subhan Allah al-Azeem",
        ur: "سبحان اللہ العظیم",
        fr: "Gloire à Allah, le Magnifique",
        id: "Subhanallah al-Azhim",
        de: "Gepriesen sei Allah, der Erhabene",
        es: "Gloria a Allah, el Grandioso"
    },
    {
        ar: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ سُبْحَانَ اللَّهِ الْعَظِيمِ",
        en: "Subhan Allah wa bihamdihi, Subhan Allah al-Azeem",
        ur: "سبحان اللہ وبحمدہ، سبحان اللہ العظیم",
        fr: "Gloire à Allah et louange à Lui; gloire à Allah le Magnifique",
        id: "Subhanallah wa bihamdihi, Subhanallah al-Azhim",
        de: "Gepriesen sei Allah und gelobt sei Er; gepriesen sei Allah, der Erhabene",
        es: "Gloria a Allah y alabanzas a Él; gloria a Allah el Grandioso"
    },
    {
        ar: "سُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ",
        en: "Subhan Allah wal hamdulillah",
        ur: "سبحان اللہ والحمد للہ",
        fr: "Gloire à Allah et louange à Allah",
        id: "Subhanallah walhamdulillah",
        de: "Gepriesen sei Allah und gelobt sei Allah",
        es: "Gloria a Allah y alabado sea Allah"
    },
    {
        ar: "سُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ وَلَا إِلَٰهَ إِلَّا اللَّهُ وَاللَّهُ أَكْبَرُ",
        en: "Subhan Allah, Alhamdulillah, La ilaha illallah, Allahu Akbar",
        ur: "سبحان اللہ، الحمد للہ، لا الٰہ الا اللہ، اللہ اکبر",
        fr: "Gloire à Allah, louange à Allah, nul n'est digne d'adoration sauf Allah, Allah est le Plus Grand",
        id: "Subhanallah, Alhamdulillah, La ilaha illallah, Allahu Akbar",
        de: "Gepriesen sei Allah, gelobt sei Allah, es gibt keinen Gott außer Allah, Allah ist der Größte",
        es: "Gloria a Allah, alabado sea Allah, no hay divinidad salvo Allah, Allah es el Más Grande"
    },
    {
        ar: "لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ",
        en: "La ilaha illallah wahdahu la sharika lah",
        ur: "لا الٰہ الا اللہ وحدہ لا شریک لہ",
        fr: "Il n'y a de divinité qu'Allah, Seul, sans associé",
        id: "La ilaha illallah wahdahu la sharika lah",
        de: "Es gibt keinen Gott außer Allah, Er allein, ohne Teilhaber",
        es: "No hay divinidad salvo Allah, Único, sin asociado"
    },
    {
        ar: "لَا إِلَٰهَ إِلَّا اللَّهُ مُحَمَّدٌ رَسُولُ اللَّهِ",
        en: "La ilaha illallah, Muhammadun Rasulullah",
        ur: "لا الٰہ الا اللہ محمد رسول اللہ",
        fr: "Il n'y a de divinité qu'Allah, Muhammad est le Messager d'Allah",
        id: "La ilaha illallah, Muhammadun Rasulullah",
        de: "Es gibt keinen Gott außer Allah, Muhammad ist Allahs Gesandter",
        es: "No hay divinidad salvo Allah, Muhammad es el Mensajero de Allah"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
        en: "Alhamdulillahi Rabbil alameen",
        ur: "الحمد للہ رب العالمین",
        fr: "Louange à Allah, Seigneur des mondes",
        id: "Alhamdulillahi Rabbil alamin",
        de: "Gelobt sei Allah, der Herr der Welten",
        es: "Alabado sea Allah, Señor de los mundos"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيهِ",
        en: "Alhamdulillahi hamdan katheeran tayyiban mubarakan feeh",
        ur: "الحمد للہ حمداً کثیراً طیباً مبارکاً فیہ",
        fr: "Louange abondante, pure et bénie à Allah",
        id: "Alhamdulillahi hamdan katsiran thayyiban mubarakan fih",
        de: "Reichlicher, reiner und gesegneter Lobpreis sei Allah",
        es: "Alabanzas abundantes, puras y benditas para Allah"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ",
        en: "Alhamdulillah alladhi bini'matihi tatimmus salihat",
        ur: "الحمد للہ الذی بنعمتہ تتم الصالحات",
        fr: "Louange à Allah par la grâce de qui les bonnes œuvres s'accomplissent",
        id: "Alhamdulillah alladzi bini'matihi tatimmush shalihat",
        de: "Gelobt sei Allah, durch dessen Gunst die guten Taten vollendet werden",
        es: "Alabado sea Allah, por cuyo favor se completan las buenas obras"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ عَلَى كُلِّ حَالٍ",
        en: "Alhamdulillah ala kulli hal",
        ur: "الحمد للہ علیٰ کل حال",
        fr: "Louange à Allah en toute situation",
        id: "Alhamdulillah 'ala kulli hal",
        de: "Gelobt sei Allah in jeder Lage",
        es: "Alabado sea Allah en toda situación"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا",
        en: "Alhamdulillah alladhi at'amana wa saqana",
        ur: "الحمد للہ الذی اطعمنا وسقانا",
        fr: "Louange à Allah qui nous a nourris et abreuvés",
        id: "Alhamdulillah alladzi ath'amana wa saqana",
        de: "Gelobt sei Allah, der uns speiste und tränkte",
        es: "Alabado sea Allah que nos alimentó y nos dio de beber"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ الَّذِي هَدَانَا لِهَٰذَا",
        en: "Alhamdulillah alladhi hadana lihadha",
        ur: "الحمد للہ الذی ہدانا لہٰذا",
        fr: "Louange à Allah qui nous a guidés vers cela",
        id: "Alhamdulillah alladzi hadana lihadza",
        de: "Gelobt sei Allah, der uns dazu geführt hat",
        es: "Alabado sea Allah que nos guio a esto"
    },
    {
        ar: "اللَّهُ أَكْبَرُ كَبِيرًا",
        en: "Allahu Akbar kabira",
        ur: "اللہ اکبر کبیراً",
        fr: "Allah est immensément Grand",
        id: "Allahu Akbar kabira",
        de: "Allah ist sehr groß",
        es: "Allah es inmensamente Grande"
    },
    {
        ar: "اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ لَا إِلَٰهَ إِلَّا اللَّهُ",
        en: "Allahu Akbar, Allahu Akbar, La ilaha illallah",
        ur: "اللہ اکبر، اللہ اکبر، لا الٰہ الا اللہ",
        fr: "Allah est le Plus Grand, Allah est le Plus Grand, nul n'est digne d'adoration sauf Allah",
        id: "Allahu Akbar, Allahu Akbar, La ilaha illallah",
        de: "Allah ist der Größte, Allah ist der Größte, es gibt keinen Gott außer Allah",
        es: "Allah es el Más Grande, Allah es el Más Grande, no hay divinidad salvo Allah"
    },
    {
        ar: "سُبْحَانَ رَبِّيَ الْعَظِيمِ",
        en: "Subhana Rabbiyal Azeem",
        ur: "سبحان ربی العظیم",
        fr: "Gloire à mon Seigneur le Magnifique",
        id: "Subhana Rabbiyal Azhim",
        de: "Gepriesen sei mein Herr, der Erhabene",
        es: "Gloria a mi Señor, el Grandioso"
    },
    {
        ar: "سُبْحَانَ رَبِّيَ الْأَعْلَى",
        en: "Subhana Rabbiyal A'la",
        ur: "سبحان ربی الاعلیٰ",
        fr: "Gloire à mon Seigneur le Très Haut",
        id: "Subhana Rabbiyal A'la",
        de: "Gepriesen sei mein Herr, der Allerhöchste",
        es: "Gloria a mi Señor, el Altísimo"
    },
    {
        ar: "سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ",
        en: "Subhanakallahumma wa bihamdik",
        ur: "سبحانک اللہم وبحمدک",
        fr: "Gloire à Toi, ô Allah, et louange à Toi",
        id: "Subhanakallahumma wa bihamdik",
        de: "Gepriesen seist Du, o Allah, und gelobt seist Du",
        es: "Gloria a Ti, oh Allah, y alabanzas a Ti"
    },
    {
        ar: "تَبَارَكَ اسْمُكَ وَتَعَالَى جَدُّكَ",
        en: "Tabarakasmuka wa ta'ala jadduk",
        ur: "تبارک اسمک وتعالیٰ جدک",
        fr: "Béni est Ton Nom et exaltée est Ta Majesté",
        id: "Tabarakasmuka wa ta'ala jadduk",
        de: "Gesegnet ist Dein Name und erhaben ist Deine Majestät",
        es: "Bendito es Tu Nombre y exaltada es Tu Majestad"
    },
    {
        ar: "لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
        en: "La ilaha illa Anta, Subhanaka inni kuntu minaz zalimeen",
        ur: "لا الٰہ الا انت سبحانک انی کنت من الظالمین",
        fr: "Nulle divinité sauf Toi. Gloire à Toi. J'ai été parmi les injustes",
        id: "La ilaha illa Anta, Subhanaka inni kuntu minaz zalimin",
        de: "Es gibt keinen Gott außer Dir. Gepriesen seist Du. Ich gehörte zu den Ungerechten",
        es: "No hay divinidad salvo Tú. Gloria a Ti. Fui de los injustos"
    },

    // Istighfar (15)
    {
        ar: "أَسْتَغْفِرُ اللَّهَ",
        en: "Astaghfirullah",
        ur: "استغفر اللہ",
        fr: "Je demande pardon à Allah",
        id: "Astaghfirullah",
        de: "Ich bitte Allah um Vergebung",
        es: "Pido perdón a Allah"
    },
    {
        ar: "أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ",
        en: "Astaghfirullah al-Azeem",
        ur: "استغفر اللہ العظیم",
        fr: "Je demande pardon à Allah le Magnifique",
        id: "Astaghfirullah al-Azhim",
        de: "Ich bitte Allah, den Erhabenen, um Vergebung",
        es: "Pido perdón a Allah, el Grandioso"
    },
    {
        ar: "أَسْتَغْفِرُ اللَّهَ رَبِّي وَأَتُوبُ إِلَيْهِ",
        en: "Astaghfirullaha Rabbi wa atubu ilayh",
        ur: "استغفر اللہ ربی واتوب الیہ",
        fr: "Je demande pardon à Allah, mon Seigneur, et je me repens à Lui",
        id: "Astaghfirullaha Rabbi wa atubu ilayh",
        de: "Ich bitte Allah, meinen Herrn, um Vergebung und wende mich Ihm zu",
        es: "Pido perdón a Allah, mi Señor, y me arrepiento ante Él"
    },
    {
        ar: "أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ",
        en: "Astaghfirullah wa atubu ilayh",
        ur: "استغفر اللہ واتوب الیہ",
        fr: "Je demande pardon à Allah et je me repens à Lui",
        id: "Astaghfirullah wa atubu ilayh",
        de: "Ich bitte Allah um Vergebung und wende mich Ihm zu",
        es: "Pido perdón a Allah y me arrepiento ante Él"
    },
    {
        ar: "رَبِّ اغْفِرْ لِي",
        en: "Rabbighfir li",
        ur: "رب اغفر لی",
        fr: "Seigneur, pardonne-moi",
        id: "Ya Rabb, ampunilah aku",
        de: "Herr, vergib mir",
        es: "Señor, perdóname"
    },
    {
        ar: "رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ",
        en: "Rabbighfir li wa tub alayya",
        ur: "رب اغفر لی وتب علی",
        fr: "Seigneur, pardonne-moi et accepte mon repentir",
        id: "Ya Rabb, ampunilah aku dan terimalah taubatku",
        de: "Herr, vergib mir und nimm meine Reue an",
        es: "Señor, perdóname y acepta mi arrepentimiento"
    },
    {
        ar: "رَبَّنَا اغْفِرْ لَنَا ذُنُوبَنَا",
        en: "Rabbanaghfir lana dhunubana",
        ur: "ربنا اغفر لنا ذنوبنا",
        fr: "Notre Seigneur, pardonne-nous nos péchés",
        id: "Ya Rabb kami, ampunilah dosa-dosa kami",
        de: "Unser Herr, vergib uns unsere Sünden",
        es: "Señor nuestro, perdónanos nuestros pecados"
    },
    {
        ar: "رَبَّنَا اغْفِرْ لَنَا وَلِإِخْوَانِنَا",
        en: "Rabbanaghfir lana wa li ikhwanina",
        ur: "ربنا اغفر لنا ولاخواننا",
        fr: "Notre Seigneur, pardonne-nous et à nos frères",
        id: "Ya Rabb kami, ampunilah kami dan saudara-saudara kami",
        de: "Unser Herr, vergib uns und unseren Brüdern",
        es: "Señor nuestro, perdónanos y a nuestros hermanos"
    },
    {
        ar: "اللَّهُمَّ اغْفِرْ لِي",
        en: "Allahummaghfir li",
        ur: "اللہم اغفر لی",
        fr: "Ô Allah, pardonne-moi",
        id: "Ya Allah, ampunilah aku",
        de: "O Allah, vergib mir",
        es: "Oh Allah, perdóname"
    },
    {
        ar: "اللَّهُمَّ اغْفِرْ لِي ذَنْبِي كُلَّهُ",
        en: "Allahummaghfir li dhanbi kullah",
        ur: "اللہم اغفر لی ذنبی کلہ",
        fr: "Ô Allah, pardonne-moi tous mes péchés",
        id: "Ya Allah, ampunilah semua dosaku",
        de: "O Allah, vergib mir alle meine Sünden",
        es: "Oh Allah, perdóname todos mis pecados"
    },
    {
        ar: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
        en: "Allahumma innaka Afuwwun tuhibbul afwa fa'fu anni",
        ur: "اللہم انک عفو تحب العفو فاعف عنی",
        fr: "Ô Allah, Tu es Pardonneur, Tu aimes le pardon, alors pardonne-moi",
        id: "Ya Allah, sesungguhnya Engkau Maha Pemaaf, Engkau menyukai maaf, maka maafkanlah aku",
        de: "O Allah, Du bist der Vergebende, Du liebst die Vergebung, so vergib mir",
        es: "Oh Allah, Tú eres Perdonador, amas el perdón, así que perdóname"
    },
    {
        ar: "اللَّهُمَّ اغْفِرْ لِي وَارْحَمْنِي",
        en: "Allahummaghfir li warhamni",
        ur: "اللہم اغفر لی وارحمنی",
        fr: "Ô Allah, pardonne-moi et fais-moi miséricorde",
        id: "Ya Allah, ampunilah aku dan rahmatilah aku",
        de: "O Allah, vergib mir und erbarme Dich meiner",
        es: "Oh Allah, perdóname y ten misericordia de mí"
    },
    {
        ar: "اللَّهُمَّ اغْفِرْ لِي وَاهْدِنِي",
        en: "Allahummaghfir li wahdini",
        ur: "اللہم اغفر لی واہدنی",
        fr: "Ô Allah, pardonne-moi et guide-moi",
        id: "Ya Allah, ampunilah aku dan berilah petunjuk kepadaku",
        de: "O Allah, vergib mir und leite mich",
        es: "Oh Allah, perdóname y guíame"
    },
    {
        ar: "اللَّهُمَّ اغْفِرْ لِي وَعَافِنِي",
        en: "Allahummaghfir li wa afini",
        ur: "اللہم اغفر لی وعافنی",
        fr: "Ô Allah, pardonne-moi et accorde-moi la santé",
        id: "Ya Allah, ampunilah aku dan berilah kesehatan kepadaku",
        de: "O Allah, vergib mir und gewähre mir Gesundheit",
        es: "Oh Allah, perdóname y concédeme bienestar"
    },
    {
        ar: "أَسْتَغْفِرُ اللَّهَ الَّذِي لَا إِلَٰهَ إِلَّا هُوَ",
        en: "Astaghfirullah alladhi la ilaha illa Huwa",
        ur: "استغفر اللہ الذی لا الٰہ الا ہو",
        fr: "Je demande pardon à Allah, en dehors de qui il n'y a pas de divinité",
        id: "Astaghfirullah alladzi la ilaha illa Huwa",
        de: "Ich bitte Allah um Vergebung, außer dem es keinen Gott gibt",
        es: "Pido perdón a Allah, fuera de quien no hay divinidad"
    },

    // Hamd and praise (15)
    {
        ar: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ الرَّحْمَٰنِ الرَّحِيمِ",
        en: "Alhamdulillahi Rabbil alameen ar-Rahman ar-Raheem",
        ur: "الحمد للہ رب العالمین الرحمٰن الرحیم",
        fr: "Louange à Allah, Seigneur des mondes, le Tout Miséricordieux, le Très Miséricordieux",
        id: "Alhamdulillahi Rabbil alamin ar-Rahman ar-Rahim",
        de: "Gelobt sei Allah, der Herr der Welten, der Allerbarmer, der Barmherzige",
        es: "Alabado sea Allah, Señor de los mundos, el Compasivo, el Misericordioso"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ الَّذِي لَمْ يَتَّخِذْ وَلَدًا",
        en: "Alhamdulillah alladhi lam yattakhidh walada",
        ur: "الحمد للہ الذی لم یتخذ ولداً",
        fr: "Louange à Allah qui n'a pas pris d'enfant",
        id: "Alhamdulillah alladzi lam yattakhidz walada",
        de: "Gelobt sei Allah, Der sich kein Kind genommen hat",
        es: "Alabado sea Allah que no ha tomado hijo"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ الَّذِي أَنْزَلَ عَلَى عَبْدِهِ الْكِتَابَ",
        en: "Alhamdulillah alladhi anzala ala abdihil kitab",
        ur: "الحمد للہ الذی انزل علیٰ عبدہ الکتاب",
        fr: "Louange à Allah qui a fait descendre le Livre sur Son serviteur",
        id: "Alhamdulillah alladzi anzala 'ala 'abdihil kitab",
        de: "Gelobt sei Allah, Der das Buch auf Seinen Diener herabgesandt hat",
        es: "Alabado sea Allah que reveló el Libro a Su siervo"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ فَاطِرِ السَّمَاوَاتِ وَالْأَرْضِ",
        en: "Alhamdulillahi fatiris samawati wal ard",
        ur: "الحمد للہ فاطر السماوات والارض",
        fr: "Louange à Allah, Créateur des cieux et de la terre",
        id: "Alhamdulillahi fatiris samawati wal ard",
        de: "Gelobt sei Allah, dem Schöpfer der Himmel und der Erde",
        es: "Alabado sea Allah, Creador de los cielos y de la tierra"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ الَّذِي خَلَقَ السَّمَاوَاتِ وَالْأَرْضَ",
        en: "Alhamdulillah alladhi khalaqas samawati wal ard",
        ur: "الحمد للہ الذی خلق السماوات والارض",
        fr: "Louange à Allah qui a créé les cieux et la terre",
        id: "Alhamdulillah alladzi khalaqas samawati wal ard",
        de: "Gelobt sei Allah, Der die Himmel und die Erde erschuf",
        es: "Alabado sea Allah que creó los cielos y la tierra"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ الَّذِي هَدَانَا لِهَٰذَا وَمَا كُنَّا لِنَهْتَدِيَ",
        en: "Alhamdulillah alladhi hadana lihadha wa ma kunna linahtadiya",
        ur: "الحمد للہ الذی ہدانا لہٰذا وما کنا لنهتدی",
        fr: "Louange à Allah qui nous a guidés vers cela; sans Lui nous n'aurions pas été guidés",
        id: "Alhamdulillah alladzi hadana lihadza wa ma kunna linahtadi",
        de: "Gelobt sei Allah, der uns dazu geführt hat; ohne Ihn wären wir nicht rechtgeleitet worden",
        es: "Alabado sea Allah que nos guio a esto; sin Él no habríamos sido guiados"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ رَبِّ السَّمَاوَاتِ وَرَبِّ الْأَرْضِ",
        en: "Alhamdulillahi Rabbis samawati wa Rabbil ard",
        ur: "الحمد للہ رب السماوات ورب الارض",
        fr: "Louange à Allah, Seigneur des cieux et Seigneur de la terre",
        id: "Alhamdulillahi Rabbis samawati wa Rabbil ard",
        de: "Gelobt sei Allah, der Herr der Himmel und der Herr der Erde",
        es: "Alabado sea Allah, Señor de los cielos y Señor de la tierra"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ غَيْرَ مَكْفُورٍ",
        en: "Alhamdulillahi ghayra makfoor",
        ur: "الحمد للہ غیر مکفور",
        fr: "Louange à Allah, sans ingratitude",
        id: "Alhamdulillahi ghayra makfur",
        de: "Gelobt sei Allah, ohne Undankbarkeit",
        es: "Alabado sea Allah, sin ingratitud"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ حَتَّى تَرْضَى",
        en: "Alhamdulillah hatta tardha",
        ur: "الحمد للہ حتیٰ ترضیٰ",
        fr: "Louange à Allah jusqu'à ce que Tu sois satisfait",
        id: "Alhamdulillah hatta tardha",
        de: "Gelobt sei Allah, bis Du zufrieden bist",
        es: "Alabado sea Allah hasta que estés complacido"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ وَالشُّكْرُ لِلَّهِ",
        en: "Alhamdulillah wash-shukru lillah",
        ur: "الحمد للہ والشکر للہ",
        fr: "Louange à Allah et gratitude à Allah",
        id: "Alhamdulillah wash-shukru lillah",
        de: "Gelobt sei Allah und Dank sei Allah",
        es: "Alabado sea Allah y gracias a Allah"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا",
        en: "Alhamdulillah alladhi ahyana ba'da ma amatana",
        ur: "الحمد للہ الذی احیانا بعد ما اماتنا",
        fr: "Louange à Allah qui nous a redonné la vie après nous avoir fait mourir",
        id: "Alhamdulillah alladzi ahyana ba'da ma amatana",
        de: "Gelobt sei Allah, Der uns nach dem Tod wieder zum Leben erweckte",
        es: "Alabado sea Allah que nos dio vida después de habernos hecho morir"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ الَّذِي لَمْ يَجْعَلْنَا مِنَ الْمُشْرِكِينَ",
        en: "Alhamdulillah alladhi lam yaj'alna minal mushrikeen",
        ur: "الحمد للہ الذی لم یجعلنا من المشرکین",
        fr: "Louange à Allah qui ne nous a pas faits parmi les associateurs",
        id: "Alhamdulillah alladzi lam yaj'alna minal musyrikin",
        de: "Gelobt sei Allah, Der uns nicht zu den Götzendienern machte",
        es: "Alabado sea Allah que no nos hizo de los idólatras"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ عَلَى نِعْمَةِ الْإِسْلَامِ",
        en: "Alhamdulillah ala ni'matil Islam",
        ur: "الحمد للہ علیٰ نعمت الاسلام",
        fr: "Louange à Allah pour le bienfait de l'islam",
        id: "Alhamdulillah 'ala ni'matil Islam",
        de: "Gelobt sei Allah für die Gnade des Islam",
        es: "Alabado sea Allah por la bendición del islam"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ عَلَى نِعْمَةِ الْقُرْآنِ",
        en: "Alhamdulillah ala ni'matil Quran",
        ur: "الحمد للہ علیٰ نعمت القرآن",
        fr: "Louange à Allah pour le bienfait du Coran",
        id: "Alhamdulillah 'ala ni'matil Quran",
        de: "Gelobt sei Allah für die Gnade des Korans",
        es: "Alabado sea Allah por la bendición del Corán"
    },
    {
        ar: "الْحَمْدُ لِلَّهِ عَلَى نِعْمَةِ الصَّلَاةِ",
        en: "Alhamdulillah ala ni'matis salah",
        ur: "الحمد للہ علیٰ نعمت الصلاۃ",
        fr: "Louange à Allah pour le bienfait de la prière",
        id: "Alhamdulillah 'ala ni'matish shalat",
        de: "Gelobt sei Allah für die Gnade des Gebets",
        es: "Alabado sea Allah por la bendición de la oración"
    },

    // Salawat (9)
    {
        ar: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ",
        en: "Allahumma salli ala Muhammad wa ala ali Muhammad",
        ur: "اللہم صل علیٰ محمد وعلیٰ آل محمد",
        fr: "Ô Allah, accorde Tes prières à Muhammad et à la famille de Muhammad",
        id: "Ya Allah, limpahkanlah shalawat kepada Muhammad dan keluarga Muhammad",
        de: "O Allah, segne Muhammad und die Familie Muhammads",
        es: "Oh Allah, concede Tus bendiciones a Muhammad y a la familia de Muhammad"
    },
    {
        ar: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى أَزْوَاجِهِ وَذُرِّيَّتِهِ",
        en: "Allahumma salli ala Muhammad wa ala azwajihi wa dhurriyyatih",
        ur: "اللہم صل علیٰ محمد وعلیٰ ازواجہ وذریتہ",
        fr: "Ô Allah, accorde Tes prières à Muhammad, à ses épouses et à sa descendance",
        id: "Ya Allah, limpahkanlah shalawat kepada Muhammad, istri-istrinya, dan keturunannya",
        de: "O Allah, segne Muhammad, seine Gattinnen und seine Nachkommen",
        es: "Oh Allah, concede Tus bendiciones a Muhammad, a sus esposas y a su descendencia"
    },
    {
        ar: "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ",
        en: "Allahumma salli wa sallim ala nabiyyina Muhammad",
        ur: "اللہم صل وسلم علیٰ نبینا محمد",
        fr: "Ô Allah, prie et accorde la paix à notre Prophète Muhammad",
        id: "Ya Allah, limpahkanlah shalawat dan salam kepada Nabi kami Muhammad",
        de: "O Allah, segne und schenke Frieden unserem Propheten Muhammad",
        es: "Oh Allah, bendice y concede paz a nuestro Profeta Muhammad"
    },
    {
        ar: "اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ",
        en: "Allahumma barik ala Muhammad wa ala ali Muhammad",
        ur: "اللہم بارک علیٰ محمد وعلیٰ آل محمد",
        fr: "Ô Allah, bénis Muhammad et la famille de Muhammad",
        id: "Ya Allah, berkahilah Muhammad dan keluarga Muhammad",
        de: "O Allah, segne Muhammad und die Familie Muhammads",
        es: "Oh Allah, bendice a Muhammad y a la familia de Muhammad"
    },
    {
        ar: "صَلَّى اللَّهُ عَلَيْهِ وَعَلَى آلِهِ وَصَحْبِهِ وَسَلَّمَ",
        en: "Sallallahu alayhi wa ala alihi wa sahbihi wa sallam",
        ur: "صلی اللہ علیہ وعلیٰ آلہ وصحبہ وسلم",
        fr: "Que la paix et les bénédictions d'Allah soient sur lui, sa famille et ses compagnons",
        id: "Shalawat Allah atas beliau, keluarganya, dan para sahabatnya",
        de: "Allahs Segen und Frieden sei mit ihm, seiner Familie und seinen Gefährten",
        es: "Que la paz y las bendiciones de Allah sean con él, su familia y sus compañeros"
    },
    {
        ar: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ عَبْدِكَ وَرَسُولِكَ",
        en: "Allahumma salli ala Muhammad abdika wa rasulik",
        ur: "اللہم صل علیٰ محمد عبدک ورسولک",
        fr: "Ô Allah, accorde Tes prières à Muhammad, Ton serviteur et Ton messager",
        id: "Ya Allah, limpahkanlah shalawat kepada Muhammad, hamba dan utusan-Mu",
        de: "O Allah, segne Muhammad, Deinen Diener und Gesandten",
        es: "Oh Allah, concede Tus bendiciones a Muhammad, Tu siervo y Tu mensajero"
    },
    {
        ar: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى الْمُؤْمِنِينَ وَالْمُؤْمِنَاتِ",
        en: "Allahumma salli ala Muhammad wa alal mu'mineena wal mu'minat",
        ur: "اللہم صل علیٰ محمد وعلیٰ المؤمنین والمؤمنات",
        fr: "Ô Allah, accorde Tes prières à Muhammad ainsi qu'aux croyants et aux croyantes",
        id: "Ya Allah, limpahkanlah shalawat kepada Muhammad dan orang-orang beriman laki-laki dan perempuan",
        de: "O Allah, segne Muhammad und die gläubigen Männer und Frauen",
        es: "Oh Allah, concede Tus bendiciones a Muhammad y a los creyentes y las creyentes"
    },
    {
        ar: "اللَّهُمَّ اجْعَلْ صَلَاتَكَ وَسَلَامَكَ عَلَى مُحَمَّدٍ",
        en: "Allahummaj'al salataka wa salamaka ala Muhammad",
        ur: "اللہم اجعل صلاتک وسلامک علیٰ محمد",
        fr: "Ô Allah, place Tes prières et Ta paix sur Muhammad",
        id: "Ya Allah, limpahkanlah shalawat dan salam-Mu kepada Muhammad",
        de: "O Allah, lege Deinen Segen und Frieden auf Muhammad",
        es: "Oh Allah, concede Tu bendición y Tu paz a Muhammad"
    },
    {
        ar: "اللَّهُمَّ صَلِّ عَلَيْهِ وَسَلِّمْ تَسْلِيمًا",
        en: "Allahumma salli alayhi wa sallim tasleema",
        ur: "اللہم صل علیہ وسلم تسلیماً",
        fr: "Ô Allah, prie sur lui et accorde-lui une paix complète",
        id: "Ya Allah, limpahkanlah shalawat dan salam yang sempurna kepadanya",
        de: "O Allah, segne ihn und schenke ihm vollkommenen Frieden",
        es: "Oh Allah, bendícelo y concédele una paz completa"
    },

    // Quranic dhikr (15)
    {
        ar: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً",
        en: "Rabbana atina fid dunya hasanatan wa fil akhirati hasanatan",
        ur: "ربنا آتنا فی الدنیا حسنۃ وفی الآخرۃ حسنۃ",
        fr: "Notre Seigneur, accorde-nous un bien ici-bas et un bien dans l'au-delà",
        id: "Ya Rabb kami, berilah kami kebaikan di dunia dan kebaikan di akhirat",
        de: "Unser Herr, gib uns Gutes in dieser Welt und Gutes im Jenseits",
        es: "Señor nuestro, concédenos bien en esta vida y bien en la otra"
    },
    {
        ar: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
        en: "Hasbunallahu wa ni'mal wakeel",
        ur: "حسبنا اللہ ونعم الوکیل",
        fr: "Allah nous suffit, quel excellent Garant",
        id: "Hasbunallahu wa ni'mal wakil",
        de: "Allah genügt uns, und Er ist der beste Sachwalter",
        es: "Allah nos basta, y qué excelente Protector"
    },
    {
        ar: "لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ",
        en: "La ilaha illa Anta, Subhanaka",
        ur: "لا الٰہ الا انت سبحانک",
        fr: "Nulle divinité sauf Toi, gloire à Toi",
        id: "La ilaha illa Anta, Subhanaka",
        de: "Es gibt keinen Gott außer Dir, gepriesen seist Du",
        es: "No hay divinidad salvo Tú, gloria a Ti"
    },
    {
        ar: "رَبِّ زِدْنِي عِلْمًا",
        en: "Rabbi zidni ilma",
        ur: "رب زدنی علماً",
        fr: "Seigneur, augmente-moi en science",
        id: "Ya Rabb, tambahkanlah ilmu kepadaku",
        de: "Herr, mehre mein Wissen",
        es: "Señor, auméntame en conocimiento"
    },
    {
        ar: "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا",
        en: "Rabbana la tuzigh quloobana ba'da idh hadaytana",
        ur: "ربنا لا تزغ قلوبنا بعد اذ هدیتنا",
        fr: "Notre Seigneur, ne dévie pas nos cœurs après nous avoir guidés",
        id: "Ya Rabb kami, janganlah Engkau condongkan hati kami setelah Engkau memberi petunjuk",
        de: "Unser Herr, lasse unsere Herzen nicht abirren, nachdem Du uns rechtgeleitet hast",
        es: "Señor nuestro, no desvíes nuestros corazones después de habernos guiado"
    },
    {
        ar: "رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ",
        en: "Rabbana hab lana min azwajina wa dhurriyyatina qurrata a'yun",
        ur: "ربنا ہب لنا من ازواجنا وذریاتنا قرۃ اعین",
        fr: "Notre Seigneur, accorde-nous en nos épouses et nos descendants la joie des yeux",
        id: "Ya Rabb kami, anugerahkanlah kepada kami pasangan dan keturunan yang menyenangkan pandangan",
        de: "Unser Herr, schenke uns an unseren Gattinnen und Nachkommen Freude für die Augen",
        es: "Señor nuestro, concédenos en nuestras esposas y descendientes el consuelo de los ojos"
    },
    {
        ar: "رَبِّ اشْرَحْ لِي صَدْرِي",
        en: "Rabbishrah li sadri",
        ur: "رب اشرح لی صدری",
        fr: "Seigneur, ouvre-moi la poitrine",
        id: "Ya Rabb, lapangkanlah dadaku",
        de: "Herr, weite mir meine Brust",
        es: "Señor, ensancha mi pecho"
    },
    {
        ar: "رَبِّ أَعُوذُ بِكَ مِنْ هَمَزَاتِ الشَّيَاطِينِ",
        en: "Rabbi a'udhu bika min hamazatish shayateen",
        ur: "رب اعوذ بک من همزات الشیاطین",
        fr: "Seigneur, je cherche refuge auprès de Toi contre les incitations des diables",
        id: "Ya Rabb, aku berlindung kepada-Mu dari bisikan setan",
        de: "Herr, ich suche Zuflucht bei Dir vor den Einflüsterungen der Teufel",
        es: "Señor, me refugio en Ti de las insinuaciones de los demonios"
    },
    {
        ar: "رَبَّنَا تَقَبَّلْ مِنَّا إِنَّكَ أَنْتَ السَّمِيعُ الْعَلِيمُ",
        en: "Rabbana taqabbal minna innaka Antas Samee'ul Aleem",
        ur: "ربنا تقبل منا انک انت السمیع العلیم",
        fr: "Notre Seigneur, accepte de nous, car Tu es l'Audient, l'Omniscient",
        id: "Ya Rabb kami, terimalah dari kami, sesungguhnya Engkau Maha Mendengar, Maha Mengetahui",
        de: "Unser Herr, nimm von uns an, denn Du bist der Allhörende, der Allwissende",
        es: "Señor nuestro, acepta de nosotros, pues Tú eres el Oyente, el Omnisciente"
    },
    {
        ar: "رَبَّنَا اغْفِرْ لَنَا وَلِإِخْوَانِنَا الَّذِينَ سَبَقُونَا بِالْإِيمَانِ",
        en: "Rabbanaghfir lana wa li ikhwaninal ladheena sabaqoona bil iman",
        ur: "ربنا اغفر لنا ولاخواننا الذین سبقونا بالایمان",
        fr: "Notre Seigneur, pardonne-nous ainsi qu'à nos frères qui nous ont précédés dans la foi",
        id: "Ya Rabb kami, ampunilah kami dan saudara-saudara kami yang lebih dahulu beriman",
        de: "Unser Herr, vergib uns und unseren Brüdern, die uns im Glauben vorausgingen",
        es: "Señor nuestro, perdónanos y a nuestros hermanos que nos precedieron en la fe"
    },
    {
        ar: "رَبَّنَا لَا تُؤَاخِذْنَا إِنْ نَسِينَا أَوْ أَخْطَأْنَا",
        en: "Rabbana la tu'akhidhna in naseena aw akhtana",
        ur: "ربنا لا تؤاخذنا ان نسینا او اخطأنا",
        fr: "Notre Seigneur, ne nous blâme pas si nous oublions ou commettons une erreur",
        id: "Ya Rabb kami, janganlah Engkau menghukum kami jika kami lupa atau khilaf",
        de: "Unser Herr, strafe uns nicht, wenn wir vergessen oder irren",
        es: "Señor nuestro, no nos culpes si olvidamos o erramos"
    },
    {
        ar: "رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِنْ قَبْلِنَا",
        en: "Rabbana wa la tahmil alayna isran kama hamaltahu alal ladheena min qablina",
        ur: "ربنا ولا تحمل علینا اصراً کما حملتہ علی الذین من قبلنا",
        fr: "Notre Seigneur, ne fais pas peser sur nous un fardeau comme Tu l'as fait sur ceux d'avant nous",
        id: "Ya Rabb kami, janganlah Engkau bebankan kepada kami beban seperti yang Engkau bebankan kepada orang sebelum kami",
        de: "Unser Herr, lege uns keine Last auf wie die, die Du denen vor uns auferlegtest",
        es: "Señor nuestro, no nos impongas una carga como la que impusiste a los de antes"
    },
    {
        ar: "آمَنَّا بِاللَّهِ وَمَا أُنْزِلَ إِلَيْنَا",
        en: "Amanna billahi wa ma unzila ilayna",
        ur: "آمنا باللہ وما انزل الینا",
        fr: "Nous croyons en Allah et en ce qui nous a été révélé",
        id: "Kami beriman kepada Allah dan apa yang diturunkan kepada kami",
        de: "Wir glauben an Allah und das, was zu uns herabgesandt wurde",
        es: "Creemos en Allah y en lo que nos fue revelado"
    },
    {
        ar: "وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ",
        en: "Wa ma tawfeeqi illa billah",
        ur: "وما توفیقی الا باللہ",
        fr: "Ma réussite ne vient que d'Allah",
        id: "Taufikku hanya dari Allah",
        de: "Mein Erfolg kommt nur von Allah",
        es: "Mi éxito solo proviene de Allah"
    },
    {
        ar: "إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ",
        en: "Inna lillahi wa inna ilayhi raji'oon",
        ur: "انا للہ وانا الیہ راجعون",
        fr: "Nous appartenons à Allah et c'est à Lui que nous retournons",
        id: "Inna lillahi wa inna ilayhi raji'un",
        de: "Wir gehören Allah und zu Ihm kehren wir zurück",
        es: "Ciertamente pertenecemos a Allah y a Él retornamos"
    },

    // Sunnah dhikr (10)
    {
        ar: "سُبْحَانَ اللَّهِ عَدَدَ خَلْقِهِ",
        en: "Subhan Allahi adada khalqih",
        ur: "سبحان اللہ عدد خلقہ",
        fr: "Gloire à Allah autant que le nombre de Ses créatures",
        id: "Subhanallahi 'adada khalqih",
        de: "Gepriesen sei Allah so oft wie die Zahl Seiner Geschöpfe",
        es: "Gloria a Allah según el número de Sus criaturas"
    },
    {
        ar: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ",
        en: "Subhan Allahi wa bihamdihi adada khalqih",
        ur: "سبحان اللہ وبحمدہ عدد خلقہ",
        fr: "Gloire à Allah et louange à Lui autant que le nombre de Ses créatures",
        id: "Subhanallahi wa bihamdihi 'adada khalqih",
        de: "Gepriesen sei Allah und gelobt sei Er so oft wie die Zahl Seiner Geschöpfe",
        es: "Gloria a Allah y alabanzas a Él según el número de Sus criaturas"
    },
    {
        ar: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ",
        en: "Allahumma inni as'alukal afwa wal afiyah",
        ur: "اللہم انی اسألک العفو والعافیۃ",
        fr: "Ô Allah, je Te demande le pardon et la préservation",
        id: "Ya Allah, aku memohon ampunan dan kesejahteraan kepada-Mu",
        de: "O Allah, ich bitte Dich um Vergebung und Wohlergehen",
        es: "Oh Allah, te pido perdón y bienestar"
    },
    {
        ar: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ",
        en: "Allahumma inni a'udhu bika minal hammi wal hazan",
        ur: "اللہم انی اعوذ بک من الہم والحزن",
        fr: "Ô Allah, je cherche refuge auprès de Toi contre le souci et la tristesse",
        id: "Ya Allah, aku berlindung kepada-Mu dari kegelisahan dan kesedihan",
        de: "O Allah, ich suche Zuflucht bei Dir vor Sorge und Trauer",
        es: "Oh Allah, me refugio en Ti de la preocupación y la tristeza"
    },
    {
        ar: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْعَجْزِ وَالْكَسَلِ",
        en: "Allahumma inni a'udhu bika minal ajzi wal kasal",
        ur: "اللہم انی اعوذ بک من العجز والکسل",
        fr: "Ô Allah, je cherche refuge auprès de Toi contre l'incapacité et la paresse",
        id: "Ya Allah, aku berlindung kepada-Mu dari kelemahan dan kemalasan",
        de: "O Allah, ich suche Zuflucht bei Dir vor Schwäche und Faulheit",
        es: "Oh Allah, me refugio en Ti de la incapacidad y la pereza"
    },
    {
        ar: "اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ",
        en: "Allahumma a'inni ala dhikrika wa shukrika wa husni ibadatik",
        ur: "اللہم اعنی علیٰ ذکرک وشکرک وحسن عبادتک",
        fr: "Ô Allah, aide-moi à T'évoquer, à Te remercier et à T'adorer de la meilleure manière",
        id: "Ya Allah, bantulah aku dalam mengingat-Mu, bersyukur kepada-Mu, dan beribadah dengan baik",
        de: "O Allah, hilf mir, Dich zu gedenken, Dir zu danken und Dich gut anzubeten",
        es: "Oh Allah, ayúdame a recordarte, agradecerte y adorarte de la mejor manera"
    },
    {
        ar: "يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ",
        en: "Ya Hayyu Ya Qayyum, birahmatika astagheeth",
        ur: "یا حی یا قیوم برحمتک استغیث",
        fr: "Ô Vivant, ô Subsistant, je cherche secours par Ta miséricorde",
        id: "Ya Hayyu Ya Qayyum, dengan rahmat-Mu aku memohon pertolongan",
        de: "O Lebendiger, o Beständiger, ich bitte um Hilfe durch Deine Barmherzigkeit",
        es: "Oh Viviente, oh Sustentador, busco auxilio en Tu misericordia"
    },
    {
        ar: "اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ",
        en: "Allahummakfini bihalalika an haramik",
        ur: "اللہم اکفنی بحلالک عن حرامک",
        fr: "Ô Allah, rends-moi suffisant par Ton licite face à Ton illicite",
        id: "Ya Allah, cukupkanlah aku dengan yang halal dari yang haram-Mu",
        de: "O Allah, mache mich mit dem Erlaubten zufrieden gegenüber dem Verbotenen",
        es: "Oh Allah, hazme suficiente con Tu lícito frente a Tu ilícito"
    },
    {
        ar: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى",
        en: "Allahumma inni as'alukal huda wat tuqa",
        ur: "اللہم انی اسألک الہدی والتقی",
        fr: "Ô Allah, je Te demande la guidée et la piété",
        id: "Ya Allah, aku memohon petunjuk dan ketakwaan kepada-Mu",
        de: "O Allah, ich bitte Dich um Rechtleitung und Gottesfurcht",
        es: "Oh Allah, te pido guía y piedad"
    },
    {
        ar: "اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ وَاجْعَلْنِي مِنَ الْمُتَطَهِّرِينَ",
        en: "Allahummaj'alni minat tawwabeena waj'alni minal mutatahhireen",
        ur: "اللہم اجعلنی من التوابین واجعلنی من المتطہرین",
        fr: "Ô Allah, fais de moi parmi ceux qui se repentent et parmi ceux qui se purifient",
        id: "Ya Allah, jadikanlah aku termasuk orang yang bertaubat dan orang yang menyucikan diri",
        de: "O Allah, mache mich zu den Reuevollen und zu den sich Reinigenden",
        es: "Oh Allah, hazme de los que se arrepienten y de los que se purifican"
    },

    // Refuge and protection (10)
    {
        ar: "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ",
        en: "A'udhu billahi minash shaytanir rajeem",
        ur: "اعوذ باللہ من الشیطان الرجیم",
        fr: "Je cherche refuge auprès d'Allah contre Satan le lapidé",
        id: "A'udzu billahi minasy syaithanir rajim",
        de: "Ich suche Zuflucht bei Allah vor dem verfluchten Satan",
        es: "Me refugio en Allah del demonio maldito"
    },
    {
        ar: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
        en: "A'udhu bikalimatillahit tammati min sharri ma khalaq",
        ur: "اعوذ بکلمات اللہ التامات من شر ما خلق",
        fr: "Je cherche refuge dans les paroles parfaites d'Allah contre le mal de ce qu'Il a créé",
        id: "Aku berlindung dengan kalimat-kalimat Allah yang sempurna dari kejahatan makhluk-Nya",
        de: "Ich suche Zuflucht in den vollkommenen Worten Allahs vor dem Übel dessen, was Er erschuf",
        es: "Me refugio en las palabras perfectas de Allah del mal de lo que ha creado"
    },
    {
        ar: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ",
        en: "Bismillahil ladhi la yadurru ma'asmihi shay",
        ur: "بسم اللہ الذی لا یضر مع اسمہ شیء",
        fr: "Au nom d'Allah, avec le nom de qui rien ne peut nuire",
        id: "Dengan nama Allah yang dengan nama-Nya tidak ada sesuatu pun yang membahayakan",
        de: "Im Namen Allahs, mit dessen Namen nichts schaden kann",
        es: "En el nombre de Allah, con cuyo nombre nada puede dañar"
    },
    {
        ar: "حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ",
        en: "Hasbiyallahu la ilaha illa Huwa",
        ur: "حسبی اللہ لا الٰہ الا ہو",
        fr: "Allah me suffit, nulle divinité sauf Lui",
        id: "Cukuplah Allah bagiku, tiada tuhan selain Dia",
        de: "Allah genügt mir, es gibt keinen Gott außer Ihm",
        es: "Allah me basta, no hay divinidad salvo Él"
    },
    {
        ar: "اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ وَمِنْ خَلْفِي",
        en: "Allahummahfazni min bayni yadayya wa min khalfi",
        ur: "اللہم احفظنی من بین یدی ومن خلفی",
        fr: "Ô Allah, protège-moi de devant moi et de derrière moi",
        id: "Ya Allah, jagalah aku dari depan dan dari belakangku",
        de: "O Allah, beschütze mich von vorn und von hinten",
        es: "Oh Allah, protégeme por delante y por detrás"
    },
    {
        ar: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي",
        en: "Allahumma inni a'udhu bika min sharri nafsi",
        ur: "اللہم انی اعوذ بک من شر نفسی",
        fr: "Ô Allah, je cherche refuge auprès de Toi contre le mal de moi-même",
        id: "Ya Allah, aku berlindung kepada-Mu dari kejahatan diriku",
        de: "O Allah, ich suche Zuflucht bei Dir vor dem Übel meiner selbst",
        es: "Oh Allah, me refugio en Ti del mal de mí mismo"
    },
    {
        ar: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ",
        en: "Allahumma inni a'udhu bika min adhabil qabr",
        ur: "اللہم انی اعوذ بک من عذاب القبر",
        fr: "Ô Allah, je cherche refuge auprès de Toi contre le châtiment de la tombe",
        id: "Ya Allah, aku berlindung kepada-Mu dari azab kubur",
        de: "O Allah, ich suche Zuflucht bei Dir vor der Strafe des Grabes",
        es: "Oh Allah, me refugio en Ti del castigo de la tumba"
    },
    {
        ar: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ زَوَالِ نِعْمَتِكَ",
        en: "Allahumma inni a'udhu bika min zawali ni'matik",
        ur: "اللہم انی اعوذ بک من زوال نعمتک",
        fr: "Ô Allah, je cherche refuge auprès de Toi contre la disparition de Ton bienfait",
        id: "Ya Allah, aku berlindung kepada-Mu dari hilangnya nikmat-Mu",
        de: "O Allah, ich suche Zuflucht bei Dir vor dem Verlust Deiner Gnade",
        es: "Oh Allah, me refugio en Ti de la desaparición de Tu favor"
    },
    {
        ar: "رَبِّ أَعُوذُ بِكَ أَنْ يَحْضُرُونِ",
        en: "Rabbi a'udhu bika an yahdurun",
        ur: "رب اعوذ بک ان یحضرون",
        fr: "Seigneur, je cherche refuge auprès de Toi contre leur présence",
        id: "Ya Rabb, aku berlindung kepada-Mu dari kehadiran mereka",
        de: "Herr, ich suche Zuflucht bei Dir vor ihrer Gegenwart",
        es: "Señor, me refugio en Ti de su presencia"
    },
    {
        ar: "أَعُوذُ بِرَبِّ الْفَلَقِ",
        en: "A'udhu bi Rabbil falaq",
        ur: "اعوذ برب الفلق",
        fr: "Je cherche refuge auprès du Seigneur de l'aube",
        id: "Aku berlindung kepada Tuhan yang menguasai subuh",
        de: "Ich suche Zuflucht beim Herrn des Tagesanbruchs",
        es: "Me refugio en el Señor del alba"
    },

    // Supplication (10)
    {
        ar: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْجَنَّةَ",
        en: "Allahumma inni as'alukal jannah",
        ur: "اللہم انی اسألک الجنۃ",
        fr: "Ô Allah, je Te demande le Paradis",
        id: "Ya Allah, aku memohon surga kepada-Mu",
        de: "O Allah, ich bitte Dich um das Paradies",
        es: "Oh Allah, te pido el Paraíso"
    },
    {
        ar: "اللَّهُمَّ أَجِرْنِي مِنَ النَّارِ",
        en: "Allahumma ajirni minan nar",
        ur: "اللہم اجرنی من النار",
        fr: "Ô Allah, préserve-moi du Feu",
        id: "Ya Allah, lindungilah aku dari api neraka",
        de: "O Allah, bewahre mich vor dem Feuer",
        es: "Oh Allah, líbrame del Fuego"
    },
    {
        ar: "اللَّهُمَّ إِنِّي أَسْأَلُكَ رِضَاكَ وَالْجَنَّةَ",
        en: "Allahumma inni as'aluka ridaka wal jannah",
        ur: "اللہم انی اسألک رضاک والجنۃ",
        fr: "Ô Allah, je Te demande Ton agrément et le Paradis",
        id: "Ya Allah, aku memohon keridhaan-Mu dan surga",
        de: "O Allah, ich bitte Dich um Dein Wohlgefallen und das Paradies",
        es: "Oh Allah, te pido Tu complacencia y el Paraíso"
    },
    {
        ar: "اللَّهُمَّ ثَبِّتْ قَلْبِي عَلَى دِينِكَ",
        en: "Allahumma thabbit qalbi ala deenik",
        ur: "اللہم ثبت قلبی علیٰ دینک",
        fr: "Ô Allah, affermis mon cœur sur Ta religion",
        id: "Ya Allah, teguhkanlah hatiku di atas agama-Mu",
        de: "O Allah, festige mein Herz in Deiner Religion",
        es: "Oh Allah, afirma mi corazón en Tu religión"
    },
    {
        ar: "اللَّهُمَّ أَصْلِحْ لِي دِينِي",
        en: "Allahumma aslih li deeni",
        ur: "اللہم اصلح لی دینی",
        fr: "Ô Allah, améliore pour moi ma religion",
        id: "Ya Allah, perbaikilah agamaku untukku",
        de: "O Allah, mache meine Religion für mich gut",
        es: "Oh Allah, mejora para mí mi religión"
    },
    {
        ar: "رَبِّ هَبْ لِي حُكْمًا وَأَلْحِقْنِي بِالصَّالِحِينَ",
        en: "Rabbi hab li hukman wa alhiqni bis saliheen",
        ur: "رب ہب لی حکماً والحقنی بالصالحین",
        fr: "Seigneur, accorde-moi la sagesse et fais-moi rejoindre les vertueux",
        id: "Ya Rabb, anugerahkanlah kepadaku hikmah dan pertemukanlah aku dengan orang-orang saleh",
        de: "Herr, schenke mir Weisheit und geselle mich zu den Rechtschaffenen",
        es: "Señor, concédeme sabiduría y reúneme con los virtuosos"
    },
    {
        ar: "رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ",
        en: "Rabbij'alni muqeemas salah",
        ur: "رب اجعلنی مقیم الصلاۃ",
        fr: "Seigneur, fais de moi un accomplisseur de la prière",
        id: "Ya Rabb, jadikanlah aku orang yang mendirikan shalat",
        de: "Herr, mache mich zu einem, der das Gebet verrichtet",
        es: "Señor, hazme de los que cumplen la oración"
    },
    {
        ar: "رَبَّنَا وَتَقَبَّلْ دُعَاءِ",
        en: "Rabbana wa taqabbal du'a",
        ur: "ربنا وتقبل دعاء",
        fr: "Notre Seigneur, accepte mon invocation",
        id: "Ya Rabb kami, terimalah doaku",
        de: "Unser Herr, nimm mein Bittgebet an",
        es: "Señor nuestro, acepta mi súplica"
    },
    {
        ar: "اللَّهُمَّ بَارِكْ لَنَا فِيمَا رَزَقْتَنَا",
        en: "Allahumma barik lana fima razaqtana",
        ur: "اللہم بارک لنا فیما رزقتنا",
        fr: "Ô Allah, bénis-nous dans ce que Tu nous as accordé",
        id: "Ya Allah, berkahilah kami pada apa yang Engkau rezekikan kepada kami",
        de: "O Allah, segne für uns das, was Du uns beschert hast",
        es: "Oh Allah, bendícenos en lo que nos has provisto"
    },
    {
        ar: "اللَّهُمَّ إِنِّي أَسْأَلُكَ حُبَّكَ",
        en: "Allahumma inni as'aluka hubbak",
        ur: "اللہم انی اسألک حبک",
        fr: "Ô Allah, je Te demande Ton amour",
        id: "Ya Allah, aku memohon cinta-Mu",
        de: "O Allah, ich bitte Dich um Deine Liebe",
        es: "Oh Allah, te pido Tu amor"
    },

    // Tahleel and Tawheed (5)
    {
        ar: "لَا إِلَٰهَ إِلَّا اللَّهُ الْمَلِكُ الْحَقُّ الْمُبِينُ",
        en: "La ilaha illallahul Malikul Haqqul Mubeen",
        ur: "لا الٰہ الا اللہ الملک الحق المبین",
        fr: "Nulle divinité sauf Allah, le Souverain, la Vérité manifeste",
        id: "Tiada tuhan selain Allah, Raja Yang Maha Benar lagi Maha Nyata",
        de: "Es gibt keinen Gott außer Allah, dem König, der offenkundigen Wahrheit",
        es: "No hay divinidad salvo Allah, el Soberano, la Verdad manifiesta"
    },
    {
        ar: "لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
        en: "La ilaha illallah wahdahu la sharika lah, lahul mulku wa lahul hamd, wa huwa ala kulli shay'in qadeer",
        ur: "لا الٰہ الا اللہ وحدہ لا شریک لہ، لہ الملک ولہ الحمد وہو علیٰ کل شیء قدیر",
        fr: "Nulle divinité sauf Allah, Seul, sans associé; à Lui la royauté, à Lui la louange, et Il est Omnipotent",
        id: "Tiada tuhan selain Allah semata, tiada sekutu bagi-Nya; milik-Nya kerajaan dan milik-Nya pujian, dan Dia Mahakuasa atas segala sesuatu",
        de: "Es gibt keinen Gott außer Allah, Er allein, ohne Teilhaber; Sein ist die Herrschaft und Sein ist das Lob, und Er hat Macht über alle Dinge",
        es: "No hay divinidad salvo Allah, Único, sin asociado; Suyo es el reino y Suya es la alabanza, y Él es Todopoderoso"
    },
    {
        ar: "لَا إِلَٰهَ إِلَّا اللَّهُ الْعَظِيمُ الْحَلِيمُ",
        en: "La ilaha illallahul Azeemul Haleem",
        ur: "لا الٰہ الا اللہ العظیم الحلیم",
        fr: "Nulle divinité sauf Allah, l'Immense, le Très Indulgent",
        id: "Tiada tuhan selain Allah Yang Maha Agung lagi Maha Penyantun",
        de: "Es gibt keinen Gott außer Allah, dem Gewaltigen, dem Nachsichtigen",
        es: "No hay divinidad salvo Allah, el Inmenso, el Indulgente"
    },
    {
        ar: "لَا إِلَٰهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ",
        en: "La ilaha illa Anta wahdaka la sharika lak",
        ur: "لا الٰہ الا انت وحدک لا شریک لک",
        fr: "Nulle divinité sauf Toi, Seul, sans associé",
        id: "Tiada tuhan selain Engkau semata, tiada sekutu bagi-Mu",
        de: "Es gibt keinen Gott außer Dir allein, ohne Teilhaber",
        es: "No hay divinidad salvo Tú, Único, sin asociado"
    },
    {
        ar: "لَا إِلَٰهَ إِلَّا اللَّهُ رَبُّ الْعَرْشِ الْعَظِيمِ",
        en: "La ilaha illallah Rabbul arshil azeem",
        ur: "لا الٰہ الا اللہ رب العرش العظیم",
        fr: "Nulle divinité sauf Allah, Seigneur du Trône immense",
        id: "Tiada tuhan selain Allah, Tuhan 'Arsy yang agung",
        de: "Es gibt keinen Gott außer Allah, dem Herrn des gewaltigen Throns",
        es: "No hay divinidad salvo Allah, Señor del Trono inmenso"
    },

    // Glorification (5)
    {
        ar: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ وَرِضَا نَفْسِهِ",
        en: "Subhan Allahi wa bihamdihi adada khalqihi wa rida nafsih",
        ur: "سبحان اللہ وبحمدہ عدد خلقہ ورضا نفسہ",
        fr: "Gloire à Allah et louange à Lui, autant que le nombre de Ses créatures et autant que Sa satisfaction",
        id: "Subhanallah wa bihamdihi sebanyak makhluk-Nya dan seridha diri-Nya",
        de: "Gepriesen sei Allah und gelobt sei Er, so oft wie die Zahl Seiner Geschöpfe und so wie Sein Wohlgefallen",
        es: "Gloria a Allah y alabanzas a Él, según el número de Sus criaturas y según Su complacencia"
    },
    {
        ar: "سُبْحَانَ ذِي الْجَلَالِ وَالْإِكْرَامِ",
        en: "Subhana dhil jalali wal ikram",
        ur: "سبحان ذی الجلال والاکرام",
        fr: "Gloire au Détenteur de la majesté et de la générosité",
        id: "Maha Suci Pemilik keagungan dan kemuliaan",
        de: "Gepriesen sei der Besitzer der Erhabenheit und Ehre",
        es: "Gloria al Poseedor de la majestad y la generosidad"
    },
    {
        ar: "سُبْحَانَ الْمَلِكِ الْقُدُّوسِ",
        en: "Subhanal Malikil Quddus",
        ur: "سبحان الملک القدوس",
        fr: "Gloire au Souverain, le Très Saint",
        id: "Maha Suci Sang Raja Yang Maha Suci",
        de: "Gepriesen sei der König, der Heilige",
        es: "Gloria al Soberano, el Santísimo"
    },
    {
        ar: "سُبُّوحٌ قُدُّوسٌ رَبُّ الْمَلَائِكَةِ وَالرُّوحِ",
        en: "Subbuhun Quddusun Rabbul mala'ikati war ruh",
        ur: "سبوح قدوس رب الملائکۃ والروح",
        fr: "Glorifié, Saint, Seigneur des anges et de l'Esprit",
        id: "Maha Suci, Maha Kudus, Tuhan para malaikat dan ruh",
        de: "Hochheilig, Heilig, Herr der Engel und des Geistes",
        es: "Glorificado, Santo, Señor de los ángeles y del Espíritu"
    },
    {
        ar: "سُبْحَانَ اللَّهِ مِلْءَ الْمِيزَانِ",
        en: "Subhan Allahi mil'al meezan",
        ur: "سبحان اللہ ملء المیزان",
        fr: "Gloire à Allah autant que le poids de la balance",
        id: "Maha Suci Allah sepenuh timbangan",
        de: "Gepriesen sei Allah, die Waage füllend",
        es: "Gloria a Allah cuanto llene la balanza"
    },

    // Reliance, gratitude and morning dhikr (10)
    {
        ar: "اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا",
        en: "Allahumma bika asbahna wa bika amsayna",
        ur: "اللہم بک اصبحنا وبک امسینا",
        fr: "Ô Allah, c'est par Toi que nous entrons dans le matin et par Toi dans le soir",
        id: "Ya Allah, dengan-Mu kami memasuki pagi dan dengan-Mu kami memasuki petang",
        de: "O Allah, mit Dir erleben wir den Morgen und mit Dir den Abend",
        es: "Oh Allah, contigo amanecemos y contigo anochecemos"
    },
    {
        ar: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ",
        en: "Asbahna wa asbahal mulku lillah",
        ur: "اصبحنا واصبح الملک للہ",
        fr: "Nous voici au matin et la royauté appartient à Allah",
        id: "Kami memasuki pagi dan kerajaan adalah milik Allah",
        de: "Wir erleben den Morgen, und die Herrschaft gehört Allah",
        es: "Amanecemos y el reino pertenece a Allah"
    },
    {
        ar: "اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ فَمِنْكَ",
        en: "Allahumma ma asbaha bi min ni'matin faminka",
        ur: "اللہم ما اصبح بی من نعمۃ فمنک",
        fr: "Ô Allah, tout bienfait qui m'atteint ce matin vient de Toi",
        id: "Ya Allah, nikmat apa pun yang ada padaku di pagi ini berasal dari-Mu",
        de: "O Allah, jede Gnade, die mich am Morgen erreicht, kommt von Dir",
        es: "Oh Allah, todo favor que amanece conmigo proviene de Ti"
    },
    {
        ar: "رَضِيتُ بِاللَّهِ رَبًّا وَبِالْإِسْلَامِ دِينًا وَبِمُحَمَّدٍ نَبِيًّا",
        en: "Radeetu billahi Rabban wa bil Islami deenan wa bi Muhammadin nabiyya",
        ur: "رضیت باللہ رباً وبالاسلام دیناً وبمحمد نبیاً",
        fr: "Je suis satisfait d'Allah comme Seigneur, de l'islam comme religion et de Muhammad comme prophète",
        id: "Aku ridha Allah sebagai Tuhan, Islam sebagai agama, dan Muhammad sebagai nabi",
        de: "Ich bin zufrieden mit Allah als Herrn, dem Islam als Religion und Muhammad als Propheten",
        es: "Me complace Allah como Señor, el islam como religión y Muhammad como profeta"
    },
    {
        ar: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ خَلَقْتَنِي وَأَنَا عَبْدُكَ",
        en: "Allahumma Anta Rabbi la ilaha illa Anta, khalaqtani wa ana abduk",
        ur: "اللہم انت ربی لا الٰہ الا انت خلقتنی وانا عبدک",
        fr: "Ô Allah, Tu es mon Seigneur, nulle divinité sauf Toi; Tu m'as créé et je suis Ton serviteur",
        id: "Ya Allah, Engkau Tuhanku, tiada tuhan selain Engkau; Engkau menciptakanku dan aku hamba-Mu",
        de: "O Allah, Du bist mein Herr, es gibt keinen Gott außer Dir; Du hast mich erschaffen und ich bin Dein Diener",
        es: "Oh Allah, Tú eres mi Señor, no hay divinidad salvo Tú; Tú me creaste y soy Tu siervo"
    },
    {
        ar: "تَوَكَّلْتُ عَلَى اللَّهِ",
        en: "Tawakkaltu alallah",
        ur: "توکلت علی اللہ",
        fr: "Je place ma confiance en Allah",
        id: "Aku bertawakal kepada Allah",
        de: "Ich vertraue auf Allah",
        es: "Pongo mi confianza en Allah"
    },
    {
        ar: "مَا شَاءَ اللَّهُ لَا قُوَّةَ إِلَّا بِاللَّهِ",
        en: "Ma sha Allah la quwwata illa billah",
        ur: "ما شاء اللہ لا قوۃ الا باللہ",
        fr: "Ce qu'Allah veut; il n'y a de force qu'en Allah",
        id: "Apa yang Allah kehendaki; tiada kekuatan kecuali dengan Allah",
        de: "Was Allah will; es gibt keine Kraft außer durch Allah",
        es: "Lo que Allah quiera; no hay fuerza sino en Allah"
    },
    {
        ar: "اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا",
        en: "Allahumma la sahla illa ma ja'altahu sahla",
        ur: "اللہم لا سہل الا ما جعلتہ سہلاً",
        fr: "Ô Allah, rien n'est facile sauf ce que Tu rends facile",
        id: "Ya Allah, tidak ada yang mudah kecuali yang Engkau jadikan mudah",
        de: "O Allah, nichts ist leicht außer dem, was Du leicht machst",
        es: "Oh Allah, nada es fácil salvo lo que Tú haces fácil"
    },
    {
        ar: "اللَّهُمَّ اهْدِنِي وَسَدِّدْنِي",
        en: "Allahummahdini wa saddidni",
        ur: "اللہم اہدنی وسددنی",
        fr: "Ô Allah, guide-moi et rends-moi droit",
        id: "Ya Allah, berilah aku petunjuk dan keluruskanlah aku",
        de: "O Allah, leite mich recht und mache mich aufrichtig",
        es: "Oh Allah, guíame y hazme recto"
    },
    {
        ar: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْفِرْدَوْسَ الْأَعْلَى",
        en: "Allahumma inni as'alukal firdawsal a'la",
        ur: "اللہم انی اسألک الفردوس الاعلیٰ",
        fr: "Ô Allah, je Te demande le Firdaws le plus élevé",
        id: "Ya Allah, aku memohon kepada-Mu surga Firdaus yang tertinggi",
        de: "O Allah, ich bitte Dich um das höchste Paradies Firdaus",
        es: "Oh Allah, te pido el Firdaus más elevado"
    }
];