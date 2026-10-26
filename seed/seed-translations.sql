-- City and area names in the 9 non-English site languages (hi, ta, te, mr, kn, bn, ml, pa, gu).
-- Hand-written standard local-script spellings for the 10 cities and 27 areas in seed/seed.sql.
-- Idempotent (INSERT OR IGNORE). Requires migrations/0004_translations.sql.

-- ---------- cities ----------
INSERT OR IGNORE INTO city_translations (city_id, lang, name) VALUES
 -- Hindi
 ('city_delhi','hi','दिल्ली'),('city_bangalore','hi','बेंगलुरु'),('city_indore','hi','इंदौर'),('city_mumbai','hi','मुंबई'),('city_hyderabad','hi','हैदराबाद'),
 ('city_chennai','hi','चेन्नई'),('city_pune','hi','पुणे'),('city_kolkata','hi','कोलकाता'),('city_ahmedabad','hi','अहमदाबाद'),('city_jaipur','hi','जयपुर'),
 -- Tamil
 ('city_delhi','ta','டெல்லி'),('city_bangalore','ta','பெங்களூரு'),('city_indore','ta','இந்தூர்'),('city_mumbai','ta','மும்பை'),('city_hyderabad','ta','ஹைதராபாத்'),
 ('city_chennai','ta','சென்னை'),('city_pune','ta','புனே'),('city_kolkata','ta','கொல்கத்தா'),('city_ahmedabad','ta','அகமதாபாத்'),('city_jaipur','ta','ஜெய்ப்பூர்'),
 -- Telugu
 ('city_delhi','te','ఢిల్లీ'),('city_bangalore','te','బెంగళూరు'),('city_indore','te','ఇండోర్'),('city_mumbai','te','ముంబై'),('city_hyderabad','te','హైదరాబాద్'),
 ('city_chennai','te','చెన్నై'),('city_pune','te','పుణె'),('city_kolkata','te','కోల్‌కతా'),('city_ahmedabad','te','అహ్మదాబాద్'),('city_jaipur','te','జైపూర్'),
 -- Marathi
 ('city_delhi','mr','दिल्ली'),('city_bangalore','mr','बंगळूर'),('city_indore','mr','इंदूर'),('city_mumbai','mr','मुंबई'),('city_hyderabad','mr','हैदराबाद'),
 ('city_chennai','mr','चेन्नई'),('city_pune','mr','पुणे'),('city_kolkata','mr','कोलकाता'),('city_ahmedabad','mr','अहमदाबाद'),('city_jaipur','mr','जयपूर'),
 -- Kannada
 ('city_delhi','kn','ದೆಹಲಿ'),('city_bangalore','kn','ಬೆಂಗಳೂರು'),('city_indore','kn','ಇಂದೋರ್'),('city_mumbai','kn','ಮುಂಬೈ'),('city_hyderabad','kn','ಹೈದರಾಬಾದ್'),
 ('city_chennai','kn','ಚೆನ್ನೈ'),('city_pune','kn','ಪುಣೆ'),('city_kolkata','kn','ಕೋಲ್ಕತ್ತಾ'),('city_ahmedabad','kn','ಅಹಮದಾಬಾದ್'),('city_jaipur','kn','ಜೈಪುರ'),
 -- Bengali
 ('city_delhi','bn','দিল্লি'),('city_bangalore','bn','বেঙ্গালুরু'),('city_indore','bn','ইন্দোর'),('city_mumbai','bn','মুম্বই'),('city_hyderabad','bn','হায়দরাবাদ'),
 ('city_chennai','bn','চেন্নাই'),('city_pune','bn','পুনে'),('city_kolkata','bn','কলকাতা'),('city_ahmedabad','bn','আহমেদাবাদ'),('city_jaipur','bn','জয়পুর'),
 -- Malayalam
 ('city_delhi','ml','ഡൽഹി'),('city_bangalore','ml','ബെംഗളൂരു'),('city_indore','ml','ഇൻഡോർ'),('city_mumbai','ml','മുംബൈ'),('city_hyderabad','ml','ഹൈദരാബാദ്'),
 ('city_chennai','ml','ചെന്നൈ'),('city_pune','ml','പൂനെ'),('city_kolkata','ml','കൊൽക്കത്ത'),('city_ahmedabad','ml','അഹമ്മദാബാദ്'),('city_jaipur','ml','ജയ്പൂർ'),
 -- Punjabi
 ('city_delhi','pa','ਦਿੱਲੀ'),('city_bangalore','pa','ਬੰਗਲੌਰ'),('city_indore','pa','ਇੰਦੌਰ'),('city_mumbai','pa','ਮੁੰਬਈ'),('city_hyderabad','pa','ਹੈਦਰਾਬਾਦ'),
 ('city_chennai','pa','ਚੇਨਈ'),('city_pune','pa','ਪੁਣੇ'),('city_kolkata','pa','ਕੋਲਕਾਤਾ'),('city_ahmedabad','pa','ਅਹਿਮਦਾਬਾਦ'),('city_jaipur','pa','ਜੈਪੁਰ'),
 -- Gujarati
 ('city_delhi','gu','દિલ્હી'),('city_bangalore','gu','બેંગલુરુ'),('city_indore','gu','ઈન્દોર'),('city_mumbai','gu','મુંબઈ'),('city_hyderabad','gu','હૈદરાબાદ'),
 ('city_chennai','gu','ચેન્નઈ'),('city_pune','gu','પુણે'),('city_kolkata','gu','કોલકાતા'),('city_ahmedabad','gu','અમદાવાદ'),('city_jaipur','gu','જયપુર');

-- ---------- Delhi areas ----------
INSERT OR IGNORE INTO area_translations (area_id, lang, name) VALUES
 ('ar_del_lajpat','hi','लाजपत नगर'),('ar_del_saket','hi','साकेत'),('ar_del_rohini','hi','रोहिणी'),('ar_del_dwarka','hi','द्वारका'),('ar_del_janakpuri','hi','जनकपुरी'),
 ('ar_del_pitampura','hi','पीतमपुरा'),('ar_del_karolbagh','hi','करोल बाग'),('ar_del_cp','hi','कनॉट प्लेस'),('ar_del_gk','hi','ग्रेटर कैलाश'),('ar_del_vasantkunj','hi','वसंत कुंज'),
 ('ar_del_laxminagar','hi','लक्ष्मी नगर'),('ar_del_preetvihar','hi','प्रीत विहार'),('ar_del_rajouri','hi','राजौरी गार्डन'),('ar_del_modeltown','hi','मॉडल टाउन'),('ar_del_hauzkhas','hi','हौज़ खास'),

 ('ar_del_lajpat','ta','லஜ்பத் நகர்'),('ar_del_saket','ta','சாகேத்'),('ar_del_rohini','ta','ரோகிணி'),('ar_del_dwarka','ta','துவாரகா'),('ar_del_janakpuri','ta','ஜனக்புரி'),
 ('ar_del_pitampura','ta','பீதம்புரா'),('ar_del_karolbagh','ta','கரோல் பாக்'),('ar_del_cp','ta','கன்னாட் பிளேஸ்'),('ar_del_gk','ta','கிரேட்டர் கைலாஷ்'),('ar_del_vasantkunj','ta','வசந்த் குஞ்ச்'),
 ('ar_del_laxminagar','ta','லட்சுமி நகர்'),('ar_del_preetvihar','ta','ப்ரீத் விஹார்'),('ar_del_rajouri','ta','ரஜௌரி கார்டன்'),('ar_del_modeltown','ta','மாடல் டவுன்'),('ar_del_hauzkhas','ta','ஹவுஸ் காஸ்'),

 ('ar_del_lajpat','te','లజపత్ నగర్'),('ar_del_saket','te','సాకేత్'),('ar_del_rohini','te','రోహిణి'),('ar_del_dwarka','te','ద్వారక'),('ar_del_janakpuri','te','జనక్‌పురి'),
 ('ar_del_pitampura','te','పీతంపురా'),('ar_del_karolbagh','te','కరోల్ బాగ్'),('ar_del_cp','te','కన్నాట్ ప్లేస్'),('ar_del_gk','te','గ్రేటర్ కైలాష్'),('ar_del_vasantkunj','te','వసంత్ కుంజ్'),
 ('ar_del_laxminagar','te','లక్ష్మీ నగర్'),('ar_del_preetvihar','te','ప్రీత్ విహార్'),('ar_del_rajouri','te','రజౌరి గార్డెన్'),('ar_del_modeltown','te','మోడల్ టౌన్'),('ar_del_hauzkhas','te','హౌజ్ ఖాస్'),

 ('ar_del_lajpat','mr','लाजपत नगर'),('ar_del_saket','mr','साकेत'),('ar_del_rohini','mr','रोहिणी'),('ar_del_dwarka','mr','द्वारका'),('ar_del_janakpuri','mr','जनकपुरी'),
 ('ar_del_pitampura','mr','पीतमपुरा'),('ar_del_karolbagh','mr','करोल बाग'),('ar_del_cp','mr','कॅनॉट प्लेस'),('ar_del_gk','mr','ग्रेटर कैलाश'),('ar_del_vasantkunj','mr','वसंत कुंज'),
 ('ar_del_laxminagar','mr','लक्ष्मी नगर'),('ar_del_preetvihar','mr','प्रीत विहार'),('ar_del_rajouri','mr','राजौरी गार्डन'),('ar_del_modeltown','mr','मॉडेल टाऊन'),('ar_del_hauzkhas','mr','हौज खास'),

 ('ar_del_lajpat','kn','ಲಜಪತ್ ನಗರ'),('ar_del_saket','kn','ಸಾಕೇತ್'),('ar_del_rohini','kn','ರೋಹಿಣಿ'),('ar_del_dwarka','kn','ದ್ವಾರಕಾ'),('ar_del_janakpuri','kn','ಜನಕಪುರಿ'),
 ('ar_del_pitampura','kn','ಪೀತಂಪುರಾ'),('ar_del_karolbagh','kn','ಕರೋಲ್ ಬಾಗ್'),('ar_del_cp','kn','ಕನಾಟ್ ಪ್ಲೇಸ್'),('ar_del_gk','kn','ಗ್ರೇಟರ್ ಕೈಲಾಶ್'),('ar_del_vasantkunj','kn','ವಸಂತ್ ಕುಂಜ್'),
 ('ar_del_laxminagar','kn','ಲಕ್ಷ್ಮಿ ನಗರ'),('ar_del_preetvihar','kn','ಪ್ರೀತ್ ವಿಹಾರ್'),('ar_del_rajouri','kn','ರಜೌರಿ ಗಾರ್ಡನ್'),('ar_del_modeltown','kn','ಮಾಡೆಲ್ ಟೌನ್'),('ar_del_hauzkhas','kn','ಹೌಜ್ ಖಾಸ್'),

 ('ar_del_lajpat','bn','লাজপত নগর'),('ar_del_saket','bn','সাকেত'),('ar_del_rohini','bn','রোহিণী'),('ar_del_dwarka','bn','দ্বারকা'),('ar_del_janakpuri','bn','জনকপুরী'),
 ('ar_del_pitampura','bn','পীতমপুরা'),('ar_del_karolbagh','bn','করোল বাগ'),('ar_del_cp','bn','কনট প্লেস'),('ar_del_gk','bn','গ্রেটার কৈলাশ'),('ar_del_vasantkunj','bn','বসন্ত কুঞ্জ'),
 ('ar_del_laxminagar','bn','লক্ষ্মী নগর'),('ar_del_preetvihar','bn','প্রীত বিহার'),('ar_del_rajouri','bn','রাজৌরি গার্ডেন'),('ar_del_modeltown','bn','মডেল টাউন'),('ar_del_hauzkhas','bn','হাউজ খাস'),

 ('ar_del_lajpat','ml','ലജ്പത് നഗർ'),('ar_del_saket','ml','സാകേത്'),('ar_del_rohini','ml','രോഹിണി'),('ar_del_dwarka','ml','ദ്വാരക'),('ar_del_janakpuri','ml','ജനക്പുരി'),
 ('ar_del_pitampura','ml','പീതംപുര'),('ar_del_karolbagh','ml','കരോൾ ബാഗ്'),('ar_del_cp','ml','കൊണാട്ട് പ്ലേസ്'),('ar_del_gk','ml','ഗ്രേറ്റർ കൈലാഷ്'),('ar_del_vasantkunj','ml','വസന്ത് കുഞ്ച്'),
 ('ar_del_laxminagar','ml','ലക്ഷ്മി നഗർ'),('ar_del_preetvihar','ml','പ്രീത് വിഹാർ'),('ar_del_rajouri','ml','രജൗരി ഗാർഡൻ'),('ar_del_modeltown','ml','മോഡൽ ടൗൺ'),('ar_del_hauzkhas','ml','ഹൗസ് ഖാസ്'),

 ('ar_del_lajpat','pa','ਲਾਜਪਤ ਨਗਰ'),('ar_del_saket','pa','ਸਾਕੇਤ'),('ar_del_rohini','pa','ਰੋਹਿਣੀ'),('ar_del_dwarka','pa','ਦਵਾਰਕਾ'),('ar_del_janakpuri','pa','ਜਨਕਪੁਰੀ'),
 ('ar_del_pitampura','pa','ਪੀਤਮਪੁਰਾ'),('ar_del_karolbagh','pa','ਕਰੋਲ ਬਾਗ'),('ar_del_cp','pa','ਕਨਾਟ ਪਲੇਸ'),('ar_del_gk','pa','ਗ੍ਰੇਟਰ ਕੈਲਾਸ਼'),('ar_del_vasantkunj','pa','ਵਸੰਤ ਕੁੰਜ'),
 ('ar_del_laxminagar','pa','ਲਕਸ਼ਮੀ ਨਗਰ'),('ar_del_preetvihar','pa','ਪ੍ਰੀਤ ਵਿਹਾਰ'),('ar_del_rajouri','pa','ਰਾਜੌਰੀ ਗਾਰਡਨ'),('ar_del_modeltown','pa','ਮਾਡਲ ਟਾਊਨ'),('ar_del_hauzkhas','pa','ਹੌਜ਼ ਖ਼ਾਸ'),

 ('ar_del_lajpat','gu','લાજપત નગર'),('ar_del_saket','gu','સાકેત'),('ar_del_rohini','gu','રોહિણી'),('ar_del_dwarka','gu','દ્વારકા'),('ar_del_janakpuri','gu','જનકપુરી'),
 ('ar_del_pitampura','gu','પીતમપુરા'),('ar_del_karolbagh','gu','કરોલ બાગ'),('ar_del_cp','gu','કનોટ પ્લેસ'),('ar_del_gk','gu','ગ્રેટર કૈલાશ'),('ar_del_vasantkunj','gu','વસંત કુંજ'),
 ('ar_del_laxminagar','gu','લક્ષ્મી નગર'),('ar_del_preetvihar','gu','પ્રીત વિહાર'),('ar_del_rajouri','gu','રજૌરી ગાર્ડન'),('ar_del_modeltown','gu','મોડલ ટાઉન'),('ar_del_hauzkhas','gu','હૌઝ ખાસ');

-- ---------- Bangalore areas ----------
INSERT OR IGNORE INTO area_translations (area_id, lang, name) VALUES
 ('ar_blr_jayanagar','hi','जयनगर'),('ar_blr_indiranagar','hi','इंदिरानगर'),('ar_blr_koramangala','hi','कोरमंगला'),('ar_blr_whitefield','hi','व्हाइटफ़ील्ड'),
 ('ar_blr_hsr','hi','एचएसआर लेआउट'),('ar_blr_marathahalli','hi','मराठाहल्ली'),('ar_blr_rajajinagar','hi','राजाजीनगर'),('ar_blr_jpnagar','hi','जेपी नगर'),

 ('ar_blr_jayanagar','ta','ஜெயநகர்'),('ar_blr_indiranagar','ta','இந்திராநகர்'),('ar_blr_koramangala','ta','கோரமங்களா'),('ar_blr_whitefield','ta','ஒயிட்ஃபீல்டு'),
 ('ar_blr_hsr','ta','எச்எஸ்ஆர் லேஅவுட்'),('ar_blr_marathahalli','ta','மாரத்தஹள்ளி'),('ar_blr_rajajinagar','ta','ராஜாஜிநகர்'),('ar_blr_jpnagar','ta','ஜேபி நகர்'),

 ('ar_blr_jayanagar','te','జయనగర్'),('ar_blr_indiranagar','te','ఇందిరానగర్'),('ar_blr_koramangala','te','కోరమంగళ'),('ar_blr_whitefield','te','వైట్‌ఫీల్డ్'),
 ('ar_blr_hsr','te','హెచ్‌ఎస్‌ఆర్ లేఅవుట్'),('ar_blr_marathahalli','te','మారతహళ్లి'),('ar_blr_rajajinagar','te','రాజాజీనగర్'),('ar_blr_jpnagar','te','జేపీ నగర్'),

 ('ar_blr_jayanagar','mr','जयनगर'),('ar_blr_indiranagar','mr','इंदिरानगर'),('ar_blr_koramangala','mr','कोरमंगला'),('ar_blr_whitefield','mr','व्हाइटफील्ड'),
 ('ar_blr_hsr','mr','एचएसआर लेआउट'),('ar_blr_marathahalli','mr','मराठाहळ्ळी'),('ar_blr_rajajinagar','mr','राजाजीनगर'),('ar_blr_jpnagar','mr','जेपी नगर'),

 ('ar_blr_jayanagar','kn','ಜಯನಗರ'),('ar_blr_indiranagar','kn','ಇಂದಿರಾನಗರ'),('ar_blr_koramangala','kn','ಕೋರಮಂಗಲ'),('ar_blr_whitefield','kn','ವೈಟ್‌ಫೀಲ್ಡ್'),
 ('ar_blr_hsr','kn','ಎಚ್‌ಎಸ್‌ಆರ್ ಲೇಔಟ್'),('ar_blr_marathahalli','kn','ಮಾರತಹಳ್ಳಿ'),('ar_blr_rajajinagar','kn','ರಾಜಾಜಿನಗರ'),('ar_blr_jpnagar','kn','ಜೆಪಿ ನಗರ'),

 ('ar_blr_jayanagar','bn','জয়নগর'),('ar_blr_indiranagar','bn','ইন্দিরানগর'),('ar_blr_koramangala','bn','কোরামঙ্গলা'),('ar_blr_whitefield','bn','হোয়াইটফিল্ড'),
 ('ar_blr_hsr','bn','এইচএসআর লেআউট'),('ar_blr_marathahalli','bn','মারাঠাহল্লি'),('ar_blr_rajajinagar','bn','রাজাজিনগর'),('ar_blr_jpnagar','bn','জেপি নগর'),

 ('ar_blr_jayanagar','ml','ജയനഗർ'),('ar_blr_indiranagar','ml','ഇന്ദിരാനഗർ'),('ar_blr_koramangala','ml','കോറമംഗല'),('ar_blr_whitefield','ml','വൈറ്റ്ഫീൽഡ്'),
 ('ar_blr_hsr','ml','എച്ച്എസ്ആർ ലേഔട്ട്'),('ar_blr_marathahalli','ml','മാരത്തഹള്ളി'),('ar_blr_rajajinagar','ml','രാജാജിനഗർ'),('ar_blr_jpnagar','ml','ജെപി നഗർ'),

 ('ar_blr_jayanagar','pa','ਜੈਨਗਰ'),('ar_blr_indiranagar','pa','ਇੰਦਰਾਨਗਰ'),('ar_blr_koramangala','pa','ਕੋਰਮੰਗਲਾ'),('ar_blr_whitefield','pa','ਵ੍ਹਾਈਟਫੀਲਡ'),
 ('ar_blr_hsr','pa','ਐਚਐਸਆਰ ਲੇਆਉਟ'),('ar_blr_marathahalli','pa','ਮਰਾਠਾਹੱਲੀ'),('ar_blr_rajajinagar','pa','ਰਾਜਾਜੀਨਗਰ'),('ar_blr_jpnagar','pa','ਜੇਪੀ ਨਗਰ'),

 ('ar_blr_jayanagar','gu','જયનગર'),('ar_blr_indiranagar','gu','ઇન્દિરાનગર'),('ar_blr_koramangala','gu','કોરમંગલા'),('ar_blr_whitefield','gu','વ્હાઇટફિલ્ડ'),
 ('ar_blr_hsr','gu','એચએસઆર લેઆઉટ'),('ar_blr_marathahalli','gu','મરાઠાહલ્લી'),('ar_blr_rajajinagar','gu','રાજાજીનગર'),('ar_blr_jpnagar','gu','જેપી નગર');

-- ---------- Indore areas ----------
INSERT OR IGNORE INTO area_translations (area_id, lang, name) VALUES
 ('ar_ind_vijaynagar','hi','विजय नगर'),('ar_ind_palasia','hi','पलासिया'),('ar_ind_rau','hi','राऊ'),('ar_ind_sudama','hi','सुदामा नगर'),
 ('ar_ind_vijaynagar','ta','விஜய் நகர்'),('ar_ind_palasia','ta','பலாசியா'),('ar_ind_rau','ta','ராவ்'),('ar_ind_sudama','ta','சுதாமா நகர்'),
 ('ar_ind_vijaynagar','te','విజయ్ నగర్'),('ar_ind_palasia','te','పలాసియా'),('ar_ind_rau','te','రావు'),('ar_ind_sudama','te','సుదామా నగర్'),
 ('ar_ind_vijaynagar','mr','विजय नगर'),('ar_ind_palasia','mr','पलासिया'),('ar_ind_rau','mr','राऊ'),('ar_ind_sudama','mr','सुदामा नगर'),
 ('ar_ind_vijaynagar','kn','ವಿಜಯ್ ನಗರ'),('ar_ind_palasia','kn','ಪಲಾಸಿಯಾ'),('ar_ind_rau','kn','ರಾವ್'),('ar_ind_sudama','kn','ಸುದಾಮಾ ನಗರ'),
 ('ar_ind_vijaynagar','bn','বিজয় নগর'),('ar_ind_palasia','bn','পালাসিয়া'),('ar_ind_rau','bn','রাউ'),('ar_ind_sudama','bn','সুদামা নগর'),
 ('ar_ind_vijaynagar','ml','വിജയ് നഗർ'),('ar_ind_palasia','ml','പലാസിയ'),('ar_ind_rau','ml','റാവു'),('ar_ind_sudama','ml','സുദാമ നഗർ'),
 ('ar_ind_vijaynagar','pa','ਵਿਜੇ ਨਗਰ'),('ar_ind_palasia','pa','ਪਲਾਸੀਆ'),('ar_ind_rau','pa','ਰਾਊ'),('ar_ind_sudama','pa','ਸੁਦਾਮਾ ਨਗਰ'),
 ('ar_ind_vijaynagar','gu','વિજય નગર'),('ar_ind_palasia','gu','પલાસિયા'),('ar_ind_rau','gu','રાઉ'),('ar_ind_sudama','gu','સુદામા નગર');
