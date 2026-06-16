#!/usr/bin/env python3
"""Add German (de) field to each tasbih phrase."""

from pathlib import Path

DE_BY_EN = {
    "Subhan Allah": "Gepriesen sei Allah",
    "Alhamdulillah": "Alhamdulillah",
    "Allahu Akbar": "Allahu Akbar",
    "La ilaha illallah": "La ilaha illallah",
    "La hawla wa la quwwata illa billah": "La hawla wa la quwwata illa billah",
    "Allahumma salli ala Muhammad": "O Allah, segne Muhammad",
    "Allahumma barik ala Muhammad": "O Allah, segne Muhammad mit Segen",
    "Sallallahu alayhi wa sallam": "Allahs Segen und Frieden sei mit ihm",
    "Bismillah": "Bismillah",
    "Bismillah ar-Rahman ar-Raheem": "Im Namen Allahs, des Allerbarmers, des Barmherzigen",
    "Allahumma Ameen": "O Allah, erhöre uns",
    "Ya Allah": "O Allah",
    "Ya Rabb": "O Herr",
    "Ya Rahman": "O Allerbarmer",
    "Ya Raheem": "O Barmherziger",
    "Subhan Allah wa bihamdihi": "Gepriesen sei Allah und gelobt sei Er",
    "Subhan Allah al-Azeem": "Gepriesen sei Allah, der Erhabene",
    "Subhan Allah wa bihamdihi, Subhan Allah al-Azeem": "Gepriesen sei Allah und gelobt sei Er; gepriesen sei Allah, der Erhabene",
    "Subhan Allah wal hamdulillah": "Gepriesen sei Allah und gelobt sei Allah",
    "Subhan Allah, Alhamdulillah, La ilaha illallah, Allahu Akbar": "Gepriesen sei Allah, gelobt sei Allah, es gibt keinen Gott außer Allah, Allah ist der Größte",
    "La ilaha illallah wahdahu la sharika lah": "Es gibt keinen Gott außer Allah, Er allein, ohne Teilhaber",
    "La ilaha illallah, Muhammadun Rasulullah": "Es gibt keinen Gott außer Allah, Muhammad ist Allahs Gesandter",
    "Alhamdulillahi Rabbil alameen": "Gelobt sei Allah, der Herr der Welten",
    "Alhamdulillahi hamdan katheeran tayyiban mubarakan feeh": "Reichlicher, reiner und gesegneter Lobpreis sei Allah",
    "Alhamdulillah alladhi bini'matihi tatimmus salihat": "Gelobt sei Allah, durch dessen Gunst die guten Taten vollendet werden",
    "Alhamdulillah ala kulli hal": "Gelobt sei Allah in jeder Lage",
    "Alhamdulillah alladhi at'amana wa saqana": "Gelobt sei Allah, der uns speiste und tränkte",
    "Alhamdulillah alladhi hadana lihadha": "Gelobt sei Allah, der uns dazu geführt hat",
    "Allahu Akbar kabira": "Allah ist sehr groß",
    "Allahu Akbar, Allahu Akbar, La ilaha illallah": "Allah ist der Größte, Allah ist der Größte, es gibt keinen Gott außer Allah",
    "Subhana Rabbiyal Azeem": "Gepriesen sei mein Herr, der Erhabene",
    "Subhana Rabbiyal A'la": "Gepriesen sei mein Herr, der Allerhöchste",
    "Subhanakallahumma wa bihamdik": "Gepriesen seist Du, o Allah, und gelobt seist Du",
    "Tabarakasmuka wa ta'ala jadduk": "Gesegnet ist Dein Name und erhaben ist Deine Majestät",
    "La ilaha illa Anta, Subhanaka inni kuntu minaz zalimeen": "Es gibt keinen Gott außer Dir. Gepriesen seist Du. Ich gehörte zu den Ungerechten",
    "Astaghfirullah": "Ich bitte Allah um Vergebung",
    "Astaghfirullah al-Azeem": "Ich bitte Allah, den Erhabenen, um Vergebung",
    "Astaghfirullaha Rabbi wa atubu ilayh": "Ich bitte Allah, meinen Herrn, um Vergebung und wende mich Ihm zu",
    "Astaghfirullah wa atubu ilayh": "Ich bitte Allah um Vergebung und wende mich Ihm zu",
    "Rabbighfir li": "Herr, vergib mir",
    "Rabbighfir li wa tub alayya": "Herr, vergib mir und nimm meine Reue an",
    "Rabbanaghfir lana dhunubana": "Unser Herr, vergib uns unsere Sünden",
    "Rabbanaghfir lana wa li ikhwanina": "Unser Herr, vergib uns und unseren Brüdern",
    "Allahummaghfir li": "O Allah, vergib mir",
    "Allahummaghfir li dhanbi kullah": "O Allah, vergib mir alle meine Sünden",
    "Allahumma innaka Afuwwun tuhibbul afwa fa'fu anni": "O Allah, Du bist der Vergebende, Du liebst die Vergebung, so vergib mir",
    "Allahummaghfir li warhamni": "O Allah, vergib mir und erbarme Dich meiner",
    "Allahummaghfir li wahdini": "O Allah, vergib mir und leite mich",
    "Allahummaghfir li wa afini": "O Allah, vergib mir und gewähre mir Gesundheit",
    "Astaghfirullah alladhi la ilaha illa Huwa": "Ich bitte Allah um Vergebung, außer dem es keinen Gott gibt",
    "Alhamdulillahi Rabbil alameen ar-Rahman ar-Raheem": "Gelobt sei Allah, der Herr der Welten, der Allerbarmer, der Barmherzige",
    "Alhamdulillah alladhi lam yattakhidh walada": "Gelobt sei Allah, Der sich kein Kind genommen hat",
    "Alhamdulillah alladhi anzala ala abdihil kitab": "Gelobt sei Allah, Der das Buch auf Seinen Diener herabgesandt hat",
    "Alhamdulillahi fatiris samawati wal ard": "Gelobt sei Allah, dem Schöpfer der Himmel und der Erde",
    "Alhamdulillah alladhi khalaqas samawati wal ard": "Gelobt sei Allah, Der die Himmel und die Erde erschuf",
    "Alhamdulillah alladhi hadana lihadha wa ma kunna linahtadiya": "Gelobt sei Allah, der uns dazu geführt hat; ohne Ihn wären wir nicht rechtgeleitet worden",
    "Alhamdulillahi Rabbis samawati wa Rabbil ard": "Gelobt sei Allah, der Herr der Himmel und der Herr der Erde",
    "Alhamdulillahi ghayra makfoor": "Gelobt sei Allah, ohne Undankbarkeit",
    "Alhamdulillah hatta tardha": "Gelobt sei Allah, bis Du zufrieden bist",
    "Alhamdulillah wash-shukru lillah": "Gelobt sei Allah und Dank sei Allah",
    "Alhamdulillah alladhi ahyana ba'da ma amatana": "Gelobt sei Allah, Der uns nach dem Tod wieder zum Leben erweckte",
    "Alhamdulillah alladhi lam yaj'alna minal mushrikeen": "Gelobt sei Allah, Der uns nicht zu den Götzendienern machte",
    "Alhamdulillah ala ni'matil Islam": "Gelobt sei Allah für die Gnade des Islam",
    "Alhamdulillah ala ni'matil Quran": "Gelobt sei Allah für die Gnade des Korans",
    "Alhamdulillah ala ni'matis salah": "Gelobt sei Allah für die Gnade des Gebets",
    "Allahumma salli ala Muhammad wa ala ali Muhammad": "O Allah, segne Muhammad und die Familie Muhammads",
    "Allahumma salli ala Muhammad wa ala azwajihi wa dhurriyyatih": "O Allah, segne Muhammad, seine Gattinnen und seine Nachkommen",
    "Allahumma salli wa sallim ala nabiyyina Muhammad": "O Allah, segne und schenke Frieden unserem Propheten Muhammad",
    "Allahumma barik ala Muhammad wa ala ali Muhammad": "O Allah, segne Muhammad und die Familie Muhammads",
    "Sallallahu alayhi wa ala alihi wa sahbihi wa sallam": "Allahs Segen und Frieden sei mit ihm, seiner Familie und seinen Gefährten",
    "Allahumma salli ala sayyidina Muhammad": "O Allah, segne unseren Herrn Muhammad",
    "Allahumma salli ala Muhammad abdika wa rasulik": "O Allah, segne Muhammad, Deinen Diener und Gesandten",
    "Allahumma salli ala Muhammad wa alal mu'mineena wal mu'minat": "O Allah, segne Muhammad und die gläubigen Männer und Frauen",
    "Allahummaj'al salataka wa salamaka ala sayyidina Muhammad": "O Allah, lege Deinen Segen und Frieden auf unseren Herrn Muhammad",
    "Allahumma salli alayhi wa sallim tasleema": "O Allah, segne ihn und schenke ihm vollkommenen Frieden",
    "Rabbana atina fid dunya hasanatan wa fil akhirati hasanatan": "Unser Herr, gib uns Gutes in dieser Welt und Gutes im Jenseits",
    "Hasbunallahu wa ni'mal wakeel": "Allah genügt uns, und Er ist der beste Sachwalter",
    "La ilaha illa Anta, Subhanaka": "Es gibt keinen Gott außer Dir, gepriesen seist Du",
    "Rabbi zidni ilma": "Herr, mehre mein Wissen",
    "Rabbana la tuzigh quloobana ba'da idh hadaytana": "Unser Herr, lasse unsere Herzen nicht abirren, nachdem Du uns rechtgeleitet hast",
    "Rabbana hab lana min azwajina wa dhurriyyatina qurrata a'yun": "Unser Herr, schenke uns an unseren Gattinnen und Nachkommen Freude für die Augen",
    "Rabbishrah li sadri": "Herr, weite mir meine Brust",
    "Rabbi a'udhu bika min hamazatish shayateen": "Herr, ich suche Zuflucht bei Dir vor den Einflüsterungen der Teufel",
    "Rabbana taqabbal minna innaka Antas Samee'ul Aleem": "Unser Herr, nimm von uns an, denn Du bist der Allhörende, der Allwissende",
    "Rabbanaghfir lana wa li ikhwaninal ladheena sabaqoona bil iman": "Unser Herr, vergib uns und unseren Brüdern, die uns im Glauben vorausgingen",
    "Rabbana la tu'akhidhna in naseena aw akhtana": "Unser Herr, strafe uns nicht, wenn wir vergessen oder irren",
    "Rabbana wa la tahmil alayna isran kama hamaltahu alal ladheena min qablina": "Unser Herr, lege uns keine Last auf wie die, die Du denen vor uns auferlegtest",
    "Amanna billahi wa ma unzila ilayna": "Wir glauben an Allah und das, was zu uns herabgesandt wurde",
    "Wa ma tawfeeqi illa billah": "Mein Erfolg kommt nur von Allah",
    "Inna lillahi wa inna ilayhi raji'oon": "Wir gehören Allah und zu Ihm kehren wir zurück",
    "Subhan Allahi adada khalqih": "Gepriesen sei Allah so oft wie die Zahl Seiner Geschöpfe",
    "Subhan Allahi wa bihamdihi adada khalqih": "Gepriesen sei Allah und gelobt sei Er so oft wie die Zahl Seiner Geschöpfe",
    "Allahumma inni as'alukal afwa wal afiyah": "O Allah, ich bitte Dich um Vergebung und Wohlergehen",
    "Allahumma inni a'udhu bika minal hammi wal hazan": "O Allah, ich suche Zuflucht bei Dir vor Sorge und Trauer",
    "Allahumma inni a'udhu bika minal ajzi wal kasal": "O Allah, ich suche Zuflucht bei Dir vor Schwäche und Faulheit",
    "Allahumma a'inni ala dhikrika wa shukrika wa husni ibadatik": "O Allah, hilf mir, Dich zu gedenken, Dir zu danken und Dich gut anzubeten",
    "Ya Hayyu Ya Qayyum, birahmatika astagheeth": "O Lebendiger, o Beständiger, ich bitte um Hilfe durch Deine Barmherzigkeit",
    "Allahummakfini bihalalika an haramik": "O Allah, mache mich mit dem Erlaubten zufrieden gegenüber dem Verbotenen",
    "Allahumma inni as'alukal huda wat tuqa": "O Allah, ich bitte Dich um Rechtleitung und Gottesfurcht",
    "Allahummaj'alni minat tawwabeena waj'alni minal mutatahhireen": "O Allah, mache mich zu den Reuevollen und zu den sich Reinigenden",
}

path = Path(__file__).resolve().parent.parent / "tasbih-phrases.js"
text = path.read_text(encoding="utf-8")
text = text.replace(
    "// 100 unique dhikr phrases — { ar, en, ur, fr, es, id }",
    "// 100 unique dhikr phrases — { ar, en, ur, fr, es, id, de }",
)

lines_out = []
for line in text.splitlines():
    if 'en: "' in line and "es:" in line and "de:" not in line:
        start = line.index('en: "') + 5
        end = line.index('"', start)
        en_val = line[start:end]
        if en_val not in DE_BY_EN:
            raise KeyError(f"Missing German translation for: {en_val!r}")
        de_val = DE_BY_EN[en_val].replace('"', '\\"')
        line = line.replace(', es: "', f', de: "{de_val}", es: "')
    lines_out.append(line)

path.write_text("\n".join(lines_out) + "\n", encoding="utf-8")
print(f"Updated {path.name} with de fields")
