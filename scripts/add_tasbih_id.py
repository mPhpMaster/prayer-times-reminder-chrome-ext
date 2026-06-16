#!/usr/bin/env python3
"""Add Indonesian (id) field to each tasbih phrase."""

from pathlib import Path

ID_BY_EN = {
    "Subhan Allah": "Subhanallah",
    "Alhamdulillah": "Alhamdulillah",
    "Allahu Akbar": "Allahu Akbar",
    "La ilaha illallah": "La ilaha illallah",
    "La hawla wa la quwwata illa billah": "La hawla wa la quwwata illa billah",
    "Allahumma salli ala Muhammad": "Ya Allah, limpahkanlah shalawat kepada Muhammad",
    "Allahumma barik ala Muhammad": "Ya Allah, berkahilah Muhammad",
    "Sallallahu alayhi wa sallam": "Shalawat dan salam Allah atas beliau",
    "Bismillah": "Bismillah",
    "Bismillah ar-Rahman ar-Raheem": "Bismillahirrahmanirrahim",
    "Allahumma Ameen": "Ya Allah, kabulkanlah",
    "Ya Allah": "Ya Allah",
    "Ya Rabb": "Ya Rabb",
    "Ya Rahman": "Ya Ar-Rahman",
    "Ya Raheem": "Ya Ar-Rahim",
    "Subhan Allah wa bihamdihi": "Subhanallah wa bihamdihi",
    "Subhan Allah al-Azeem": "Subhanallah al-Azhim",
    "Subhan Allah wa bihamdihi, Subhan Allah al-Azeem": "Subhanallah wa bihamdihi, Subhanallah al-Azhim",
    "Subhan Allah wal hamdulillah": "Subhanallah walhamdulillah",
    "Subhan Allah, Alhamdulillah, La ilaha illallah, Allahu Akbar": "Subhanallah, Alhamdulillah, La ilaha illallah, Allahu Akbar",
    "La ilaha illallah wahdahu la sharika lah": "La ilaha illallah wahdahu la sharika lah",
    "La ilaha illallah, Muhammadun Rasulullah": "La ilaha illallah, Muhammadun Rasulullah",
    "Alhamdulillahi Rabbil alameen": "Alhamdulillahi Rabbil alamin",
    "Alhamdulillahi hamdan katheeran tayyiban mubarakan feeh": "Alhamdulillahi hamdan katsiran thayyiban mubarakan fih",
    "Alhamdulillah alladhi bini'matihi tatimmus salihat": "Alhamdulillah alladzi bini'matihi tatimmush shalihat",
    "Alhamdulillah ala kulli hal": "Alhamdulillah 'ala kulli hal",
    "Alhamdulillah alladhi at'amana wa saqana": "Alhamdulillah alladzi ath'amana wa saqana",
    "Alhamdulillah alladhi hadana lihadha": "Alhamdulillah alladzi hadana lihadza",
    "Allahu Akbar kabira": "Allahu Akbar kabira",
    "Allahu Akbar, Allahu Akbar, La ilaha illallah": "Allahu Akbar, Allahu Akbar, La ilaha illallah",
    "Subhana Rabbiyal Azeem": "Subhana Rabbiyal Azhim",
    "Subhana Rabbiyal A'la": "Subhana Rabbiyal A'la",
    "Subhanakallahumma wa bihamdik": "Subhanakallahumma wa bihamdik",
    "Tabarakasmuka wa ta'ala jadduk": "Tabarakasmuka wa ta'ala jadduk",
    "La ilaha illa Anta, Subhanaka inni kuntu minaz zalimeen": "La ilaha illa Anta, Subhanaka inni kuntu minaz zalimin",
    "Astaghfirullah": "Astaghfirullah",
    "Astaghfirullah al-Azeem": "Astaghfirullah al-Azhim",
    "Astaghfirullaha Rabbi wa atubu ilayh": "Astaghfirullaha Rabbi wa atubu ilayh",
    "Astaghfirullah wa atubu ilayh": "Astaghfirullah wa atubu ilayh",
    "Rabbighfir li": "Ya Rabb, ampunilah aku",
    "Rabbighfir li wa tub alayya": "Ya Rabb, ampunilah aku dan terimalah taubatku",
    "Rabbanaghfir lana dhunubana": "Ya Rabb kami, ampunilah dosa-dosa kami",
    "Rabbanaghfir lana wa li ikhwanina": "Ya Rabb kami, ampunilah kami dan saudara-saudara kami",
    "Allahummaghfir li": "Ya Allah, ampunilah aku",
    "Allahummaghfir li dhanbi kullah": "Ya Allah, ampunilah semua dosaku",
    "Allahumma innaka Afuwwun tuhibbul afwa fa'fu anni": "Ya Allah, sesungguhnya Engkau Maha Pemaaf, Engkau menyukai maaf, maka maafkanlah aku",
    "Allahummaghfir li warhamni": "Ya Allah, ampunilah aku dan rahmatilah aku",
    "Allahummaghfir li wahdini": "Ya Allah, ampunilah aku dan berilah petunjuk kepadaku",
    "Allahummaghfir li wa afini": "Ya Allah, ampunilah aku dan berilah kesehatan kepadaku",
    "Astaghfirullah alladhi la ilaha illa Huwa": "Astaghfirullah alladzi la ilaha illa Huwa",
    "Alhamdulillahi Rabbil alameen ar-Rahman ar-Raheem": "Alhamdulillahi Rabbil alamin ar-Rahman ar-Rahim",
    "Alhamdulillah alladhi lam yattakhidh walada": "Alhamdulillah alladzi lam yattakhidz walada",
    "Alhamdulillah alladhi anzala ala abdihil kitab": "Alhamdulillah alladzi anzala 'ala 'abdihil kitab",
    "Alhamdulillahi fatiris samawati wal ard": "Alhamdulillahi fatiris samawati wal ard",
    "Alhamdulillah alladhi khalaqas samawati wal ard": "Alhamdulillah alladzi khalaqas samawati wal ard",
    "Alhamdulillah alladhi hadana lihadha wa ma kunna linahtadiya": "Alhamdulillah alladzi hadana lihadza wa ma kunna linahtadi",
    "Alhamdulillahi Rabbis samawati wa Rabbil ard": "Alhamdulillahi Rabbis samawati wa Rabbil ard",
    "Alhamdulillahi ghayra makfoor": "Alhamdulillahi ghayra makfur",
    "Alhamdulillah hatta tardha": "Alhamdulillah hatta tardha",
    "Alhamdulillah wash-shukru lillah": "Alhamdulillah wash-shukru lillah",
    "Alhamdulillah alladhi ahyana ba'da ma amatana": "Alhamdulillah alladzi ahyana ba'da ma amatana",
    "Alhamdulillah alladhi lam yaj'alna minal mushrikeen": "Alhamdulillah alladzi lam yaj'alna minal musyrikin",
    "Alhamdulillah ala ni'matil Islam": "Alhamdulillah 'ala ni'matil Islam",
    "Alhamdulillah ala ni'matil Quran": "Alhamdulillah 'ala ni'matil Quran",
    "Alhamdulillah ala ni'matis salah": "Alhamdulillah 'ala ni'matish shalat",
    "Allahumma salli ala Muhammad wa ala ali Muhammad": "Ya Allah, limpahkanlah shalawat kepada Muhammad dan keluarga Muhammad",
    "Allahumma salli ala Muhammad wa ala azwajihi wa dhurriyyatih": "Ya Allah, limpahkanlah shalawat kepada Muhammad, istri-istrinya, dan keturunannya",
    "Allahumma salli wa sallim ala nabiyyina Muhammad": "Ya Allah, limpahkanlah shalawat dan salam kepada Nabi kami Muhammad",
    "Allahumma barik ala Muhammad wa ala ali Muhammad": "Ya Allah, berkahilah Muhammad dan keluarga Muhammad",
    "Sallallahu alayhi wa ala alihi wa sahbihi wa sallam": "Shalawat Allah atas beliau, keluarganya, dan para sahabatnya",
    "Allahumma salli ala sayyidina Muhammad": "Ya Allah, limpahkanlah shalawat kepada junjungan kami Muhammad",
    "Allahumma salli ala Muhammad abdika wa rasulik": "Ya Allah, limpahkanlah shalawat kepada Muhammad, hamba dan utusan-Mu",
    "Allahumma salli ala Muhammad wa alal mu'mineena wal mu'minat": "Ya Allah, limpahkanlah shalawat kepada Muhammad dan orang-orang beriman laki-laki dan perempuan",
    "Allahummaj'al salataka wa salamaka ala sayyidina Muhammad": "Ya Allah, limpahkanlah shalawat dan salam-Mu kepada junjungan kami Muhammad",
    "Allahumma salli alayhi wa sallim tasleema": "Ya Allah, limpahkanlah shalawat dan salam yang sempurna kepadanya",
    "Rabbana atina fid dunya hasanatan wa fil akhirati hasanatan": "Ya Rabb kami, berilah kami kebaikan di dunia dan kebaikan di akhirat",
    "Hasbunallahu wa ni'mal wakeel": "Hasbunallahu wa ni'mal wakil",
    "La ilaha illa Anta, Subhanaka": "La ilaha illa Anta, Subhanaka",
    "Rabbi zidni ilma": "Ya Rabb, tambahkanlah ilmu kepadaku",
    "Rabbana la tuzigh quloobana ba'da idh hadaytana": "Ya Rabb kami, janganlah Engkau condongkan hati kami setelah Engkau memberi petunjuk",
    "Rabbana hab lana min azwajina wa dhurriyyatina qurrata a'yun": "Ya Rabb kami, anugerahkanlah kepada kami pasangan dan keturunan yang menyenangkan pandangan",
    "Rabbishrah li sadri": "Ya Rabb, lapangkanlah dadaku",
    "Rabbi a'udhu bika min hamazatish shayateen": "Ya Rabb, aku berlindung kepada-Mu dari bisikan setan",
    "Rabbana taqabbal minna innaka Antas Samee'ul Aleem": "Ya Rabb kami, terimalah dari kami, sesungguhnya Engkau Maha Mendengar, Maha Mengetahui",
    "Rabbanaghfir lana wa li ikhwaninal ladheena sabaqoona bil iman": "Ya Rabb kami, ampunilah kami dan saudara-saudara kami yang lebih dahulu beriman",
    "Rabbana la tu'akhidhna in naseena aw akhtana": "Ya Rabb kami, janganlah Engkau menghukum kami jika kami lupa atau khilaf",
    "Rabbana wa la tahmil alayna isran kama hamaltahu alal ladheena min qablina": "Ya Rabb kami, janganlah Engkau bebankan kepada kami beban seperti yang Engkau bebankan kepada orang sebelum kami",
    "Amanna billahi wa ma unzila ilayna": "Kami beriman kepada Allah dan apa yang diturunkan kepada kami",
    "Wa ma tawfeeqi illa billah": "Taufikku hanya dari Allah",
    "Inna lillahi wa inna ilayhi raji'oon": "Inna lillahi wa inna ilayhi raji'un",
    "Subhan Allahi adada khalqih": "Subhanallahi 'adada khalqih",
    "Subhan Allahi wa bihamdihi adada khalqih": "Subhanallahi wa bihamdihi 'adada khalqih",
    "Allahumma inni as'alukal afwa wal afiyah": "Ya Allah, aku memohon ampunan dan kesejahteraan kepada-Mu",
    "Allahumma inni a'udhu bika minal hammi wal hazan": "Ya Allah, aku berlindung kepada-Mu dari kegelisahan dan kesedihan",
    "Allahumma inni a'udhu bika minal ajzi wal kasal": "Ya Allah, aku berlindung kepada-Mu dari kelemahan dan kemalasan",
    "Allahumma a'inni ala dhikrika wa shukrika wa husni ibadatik": "Ya Allah, bantulah aku dalam mengingat-Mu, bersyukur kepada-Mu, dan beribadah dengan baik",
    "Ya Hayyu Ya Qayyum, birahmatika astagheeth": "Ya Hayyu Ya Qayyum, dengan rahmat-Mu aku memohon pertolongan",
    "Allahummakfini bihalalika an haramik": "Ya Allah, cukupkanlah aku dengan yang halal dari yang haram-Mu",
    "Allahumma inni as'alukal huda wat tuqa": "Ya Allah, aku memohon petunjuk dan ketakwaan kepada-Mu",
    "Allahummaj'alni minat tawwabeena waj'alni minal mutatahhireen": "Ya Allah, jadikanlah aku termasuk orang yang bertaubat dan orang yang menyucikan diri",
}

path = Path(__file__).resolve().parent.parent / "tasbih-phrases.js"
text = path.read_text(encoding="utf-8")
text = text.replace(
    "// 100 unique dhikr phrases — { ar, en, ur, fr, es }",
    "// 100 unique dhikr phrases — { ar, en, ur, fr, es, id }",
)

lines_out = []
for line in text.splitlines():
    if 'en: "' in line and "fr:" in line and "id:" not in line:
        start = line.index('en: "') + 5
        end = line.index('"', start)
        en_val = line[start:end]
        if en_val not in ID_BY_EN:
            raise KeyError(f"Missing Indonesian translation for: {en_val!r}")
        id_val = ID_BY_EN[en_val].replace('"', '\\"')
        line = line.replace(', es: "', f', id: "{id_val}", es: "')
    lines_out.append(line)

path.write_text("\n".join(lines_out) + "\n", encoding="utf-8")
print(f"Updated {path.name} with id fields")
