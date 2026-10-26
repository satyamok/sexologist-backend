-- Reference data: specialties, conditions, cities, areas. Idempotent (INSERT OR IGNORE on fixed ids).

INSERT OR IGNORE INTO specialties (id, name, plural, slug, description) VALUES
 ('sp_sexologist','Sexologist','Sexologists','sexologist','Doctors who diagnose and treat sexual health problems in men and women.'),
 ('sp_urologist','Urologist','Urologists','urologist','Specialists of the urinary tract and the male reproductive organs.'),
 ('sp_andrologist','Andrologist','Andrologists','andrologist','Specialists in male reproductive and sexual health.'),
 ('sp_gynecologist','Gynecologist','Gynecologists','gynecologist','Specialists in female reproductive health.'),
 ('sp_infertility','Infertility Specialist','Infertility Specialists','infertility-specialist','Doctors treating male and female infertility.'),
 ('sp_psychiatrist','Psychiatrist','Psychiatrists','psychiatrist','Mental-health specialists for psychogenic sexual problems and performance anxiety.'),
 ('sp_venereologist','Venereologist','Venereologists','venereologist','Doctors treating sexually transmitted infections.'),
 ('sp_ayurvedic','Ayurvedic Sexologist','Ayurvedic Sexologists','ayurvedic-sexologist','Ayurveda practitioners focused on sexual wellness.');

INSERT OR IGNORE INTO conditions (id, name, slug, gender_focus, description) VALUES
 ('cn_ed','Erectile Dysfunction','erectile-dysfunction','male','Difficulty getting or keeping an erection firm enough for sex.'),
 ('cn_pe','Premature Ejaculation','premature-ejaculation','male','Ejaculation that happens sooner than wanted during sex.'),
 ('cn_libido','Low Libido','low-libido','all','Reduced sexual desire in men or women.'),
 ('cn_anxiety','Performance Anxiety','performance-anxiety','all','Stress or fear about sexual performance that affects intimacy.'),
 ('cn_male_inf','Male Infertility','male-infertility','male','Problems with sperm count, motility or morphology.'),
 ('cn_vaginismus','Vaginismus','vaginismus','female','Involuntary tightening of the vaginal muscles that makes penetration painful or impossible.'),
 ('cn_dyspareunia','Painful Intercourse','painful-intercourse','female','Persistent pain during or after sex.'),
 ('cn_fsd','Female Sexual Dysfunction','female-sexual-dysfunction','female','Problems with desire, arousal, orgasm or pain in women.'),
 ('cn_sti','STI / STD','sti-std','all','Sexually transmitted infections and their treatment.'),
 ('cn_hormonal','Hormonal Imbalance','hormonal-imbalance','all','Low testosterone, thyroid or other hormonal causes of sexual problems.'),
 ('cn_de','Delayed Ejaculation','delayed-ejaculation','male','Difficulty or inability to ejaculate despite adequate stimulation.'),
 ('cn_peyronie','Peyronie''s Disease','peyronies-disease','male','Curved or painful erections caused by scar tissue in the penis.');

INSERT OR IGNORE INTO cities (id, name, slug, state, lat, lng) VALUES
 ('city_delhi','Delhi','delhi','Delhi',28.6139,77.2090),
 ('city_bangalore','Bangalore','bangalore','Karnataka',12.9716,77.5946),
 ('city_indore','Indore','indore','Madhya Pradesh',22.7196,75.8577),
 ('city_mumbai','Mumbai','mumbai','Maharashtra',19.0760,72.8777),
 ('city_hyderabad','Hyderabad','hyderabad','Telangana',17.3850,78.4867),
 ('city_chennai','Chennai','chennai','Tamil Nadu',13.0827,80.2707),
 ('city_pune','Pune','pune','Maharashtra',18.5204,73.8567),
 ('city_kolkata','Kolkata','kolkata','West Bengal',22.5726,88.3639),
 ('city_ahmedabad','Ahmedabad','ahmedabad','Gujarat',23.0225,72.5714),
 ('city_jaipur','Jaipur','jaipur','Rajasthan',26.9124,75.7873);

-- Delhi areas
INSERT OR IGNORE INTO areas (id, city_id, name, slug, pincode, zone, lat, lng, default_radius_km) VALUES
 ('ar_del_lajpat','city_delhi','Lajpat Nagar','lajpat-nagar','110024','South Delhi',28.5677,77.2433,6),
 ('ar_del_saket','city_delhi','Saket','saket','110017','South Delhi',28.5245,77.2066,6),
 ('ar_del_rohini','city_delhi','Rohini','rohini','110085','North West Delhi',28.7495,77.0565,6),
 ('ar_del_dwarka','city_delhi','Dwarka','dwarka','110075','South West Delhi',28.5921,77.0460,10),
 ('ar_del_janakpuri','city_delhi','Janakpuri','janakpuri','110058','West Delhi',28.6219,77.0878,6),
 ('ar_del_pitampura','city_delhi','Pitampura','pitampura','110034','North West Delhi',28.7034,77.1319,6),
 ('ar_del_karolbagh','city_delhi','Karol Bagh','karol-bagh','110005','Central Delhi',28.6519,77.1909,6),
 ('ar_del_cp','city_delhi','Connaught Place','connaught-place','110001','Central Delhi',28.6315,77.2167,6),
 ('ar_del_gk','city_delhi','Greater Kailash','greater-kailash','110048','South Delhi',28.5494,77.2366,6),
 ('ar_del_vasantkunj','city_delhi','Vasant Kunj','vasant-kunj','110070','South West Delhi',28.5200,77.1591,6),
 ('ar_del_laxminagar','city_delhi','Laxmi Nagar','laxmi-nagar','110092','East Delhi',28.6304,77.2777,6),
 ('ar_del_preetvihar','city_delhi','Preet Vihar','preet-vihar','110092','East Delhi',28.6416,77.2946,6),
 ('ar_del_rajouri','city_delhi','Rajouri Garden','rajouri-garden','110027','West Delhi',28.6492,77.1227,6),
 ('ar_del_modeltown','city_delhi','Model Town','model-town','110009','North Delhi',28.7158,77.1910,6),
 ('ar_del_hauzkhas','city_delhi','Hauz Khas','hauz-khas','110016','South Delhi',28.5494,77.2001,6);

-- Bangalore areas
INSERT OR IGNORE INTO areas (id, city_id, name, slug, pincode, zone, lat, lng, default_radius_km) VALUES
 ('ar_blr_jayanagar','city_bangalore','Jayanagar','jayanagar','560041','South Bangalore',12.9250,77.5938,6),
 ('ar_blr_indiranagar','city_bangalore','Indiranagar','indiranagar','560038','East Bangalore',12.9784,77.6408,6),
 ('ar_blr_koramangala','city_bangalore','Koramangala','koramangala','560034','South East Bangalore',12.9352,77.6245,6),
 ('ar_blr_whitefield','city_bangalore','Whitefield','whitefield','560066','East Bangalore',12.9698,77.7500,10),
 ('ar_blr_hsr','city_bangalore','HSR Layout','hsr-layout','560102','South East Bangalore',12.9116,77.6389,6),
 ('ar_blr_marathahalli','city_bangalore','Marathahalli','marathahalli','560037','East Bangalore',12.9591,77.6974,6),
 ('ar_blr_rajajinagar','city_bangalore','Rajajinagar','rajajinagar','560010','West Bangalore',12.9915,77.5521,6),
 ('ar_blr_jpnagar','city_bangalore','JP Nagar','jp-nagar','560078','South Bangalore',12.9063,77.5857,6);

-- Indore areas
INSERT OR IGNORE INTO areas (id, city_id, name, slug, pincode, zone, lat, lng, default_radius_km) VALUES
 ('ar_ind_vijaynagar','city_indore','Vijay Nagar','vijay-nagar','452010','North Indore',22.7533,75.8937,6),
 ('ar_ind_palasia','city_indore','Palasia','palasia','452001','Central Indore',22.7244,75.8839,6),
 ('ar_ind_rau','city_indore','Rau','rau','453331','South West Indore',22.6393,75.8166,10),
 ('ar_ind_sudama','city_indore','Sudama Nagar','sudama-nagar','452009','South Indore',22.6880,75.8390,6);
