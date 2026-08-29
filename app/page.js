'use client';
import { useState, useMemo, useEffect } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────

const NICE = [1,1.5,2,2.5,3,4,5,7.5,10,15,20,25,30,40,50,75,100];
const ZONE_COLORS = ['#E24B4A','#BA7517','#378ADD','#1D9E75','#639922','#A32D2D'];
const ZONE_BG     = ['#FCEBEB','#FAEEDA','#E6F1FB','#E1F5EE','#EAF3DE','#FCEBEB'];

const DC_PREFIX = {
  'Continuous data':        '◆ ',
  'Discrete data':          '■ ',
  'Ordinal':                '● ',
  'Special (Boolean → %)':  '◈ ',
};

const DC_CONFIG = {
  'Continuous data':       { border:'#185FA5', bg:'#E6F1FB', color:'#0C447C', desc:"Y-axis bounds computed dynamically from patient's own baseline data (buffer formula)" },
  'Discrete data':         { border:'#1D9E75', bg:'#E1F5EE', color:'#085041', desc:'Y-axis starts at 0, ceiling snaps to nearest clean tier above peak value' },
  'Ordinal':               { border:'#BA7517', bg:'#FAEEDA', color:'#633806', desc:'Fixed scale — values represent ranked categories, not continuous measurements' },
  'Special (Boolean → %)': { border:'#888780', bg:'#F1EFE8', color:'#444441', desc:'Boolean inputs converted to % adherence for chart display' },
};

// ─── Metrics data ─────────────────────────────────────────────────────────────

const METRICS = {
  'Steps':{datatypeCategory:'Discrete data',unit:'steps',y0:0,yMax:30000,goal:10000,goalLabel:'10k goal',
    zones:[{upper:5000,l:'Sedentary'},{upper:7500,l:'Low Active'},{upper:10000,l:'Somewhat Active'},{upper:12500,l:'Active'},{upper:Infinity,l:'Highly Active'}],
    tf:{
      D:{labels:['00-06','06-12','12-18','18-24'],data:[1200,3400,4200,2800],agg:'Sum per 6-hr block'},
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[7200,9400,11200,6800,10500,14000,8300],agg:'Total per day'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[8200,10500,7800,9600],agg:'Daily avg per week'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[7200,7800,9100,9600,10200,11400,10800,10100,9400,8800,7600,7100],agg:'Daily avg per month'},
    }},
  'Active Minutes':{datatypeCategory:'Discrete data',unit:'min',y0:0,yMax:120,goal:30,goalLabel:'30 min WHO',
    zones:[{upper:22,l:'Below WHO Min'},{upper:43,l:'Meets WHO Min'},{upper:86,l:'Active'},{upper:Infinity,l:'Highly Active'}],
    tf:{
      D:{labels:['00-06','06-12','12-18','18-24'],data:[0,25,40,15],agg:'Sum per 6-hr block'},
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[20,45,30,0,60,35,50],agg:'Total per day'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[28,45,22,38],agg:'Daily avg per week'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[20,22,28,32,38,42,45,43,35,30,25,18],agg:'Daily avg per month'},
    }},
  'Distance':{datatypeCategory:'Discrete data',unit:'km',y0:0,yMax:20,goal:5,goalLabel:'5 km daily',
    zones:[{upper:2,l:'Minimal'},{upper:5,l:'Light'},{upper:10,l:'Moderate'},{upper:20,l:'High'},{upper:Infinity,l:'Extreme'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[8,4.5,3,0,6,5,10],agg:'Total per day'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[5.2,6.8,4.1,7.3],agg:'Daily avg per week'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[3,3.5,4.5,5,6,7,7.5,7,6,5,4,3],agg:'Daily avg per month'},
    }},
  'Floors Climbed':{datatypeCategory:'Discrete data',unit:'floors',y0:0,yMax:30,goal:10,goalLabel:'10 floors',
    zones:[{upper:5,l:'Very Low'},{upper:10,l:'Low'},{upper:15,l:'Moderate'},{upper:25,l:'Active'},{upper:Infinity,l:'High'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[5,12,8,3,15,10,6],agg:'Total per day'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[8,11,7,13],agg:'Daily avg per week'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[6,7,8,9,10,12,11,10,9,8,7,6],agg:'Daily avg per month'},
    }},
  'VO2max':{datatypeCategory:'Continuous data',unit:'mL/kg/min',y0:10,yMax:80,dynamicBounds:true,goal:42,goalLabel:'Fair threshold',
    zones:[{upper:28,l:'Very Poor'},{upper:34,l:'Poor'},{upper:39,l:'Fair'},{upper:46,l:'Good'},{upper:53,l:'Excellent'},{upper:Infinity,l:'Superior'}],
    tf:{
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun'],data:[38,38.5,39,40,40.5,41],agg:'Monthly reading'},
    }},
  'Sedentary Time':{datatypeCategory:'Discrete data',unit:'min',y0:0,yMax:720,goal:240,goalLabel:'<4h target',goalInvert:true,
    zones:[{upper:240,l:'Low Sedentary'},{upper:360,l:'Moderate'},{upper:480,l:'High'},{upper:600,l:'Very High'},{upper:Infinity,l:'Extreme (>10h)'}],
    tf:{
      D:{labels:['00-06','06-12','12-18','18-24'],data:[360,120,200,60],agg:'Sum per 6-hr block'},
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[200,480,520,460,500,400,180],agg:'Total per day'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[420,480,390,450],agg:'Daily avg per week'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[500,490,460,420,400,380,350,370,410,430,470,510],agg:'Daily avg per month'},
    }},
  'Weight':{datatypeCategory:'Continuous data',unit:'kg',y0:30,yMax:200,dynamicBounds:true,
    zones:[{upper:50,l:'Very Low'},{upper:60,l:'Low'},{upper:85,l:'Normal'},{upper:100,l:'Overweight'},{upper:Infinity,l:'Obese range'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[72,71.8,72.2,71.5,71.9,71.6,73],agg:'Daily reading'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[73,72.5,72,71.5],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[75,74.5,74,73.5,73,72.5,72,72,72.5,73,73.5,74],agg:'Monthly avg'},
    }},
  'BMI':{datatypeCategory:'Continuous data',unit:'kg/m²',y0:10,yMax:40,dynamicBounds:true,
    zones:[{upper:18.5,l:'Underweight'},{upper:25,l:'Normal Weight'},{upper:30,l:'Overweight'},{upper:35,l:'Obese I'},{upper:40,l:'Obese II'},{upper:Infinity,l:'Obese III'}],
    tf:{
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[24.2,24.0,23.8,23.5],agg:'Derived from weight'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[25.1,24.9,24.7,24.5,24.3,24.1,24,24,24.2,24.4,24.6,24.9],agg:'Monthly avg'},
    }},
  'Heart Rate':{datatypeCategory:'Continuous data',unit:'bpm',y0:30,yMax:200,dynamicBounds:true,integerOnly:true,
    zones:[{upper:50,l:'Low'},{upper:60,l:'Below Average'},{upper:101,l:'Normal'},{upper:151,l:'Elevated'},{upper:Infinity,l:'High'}],
    tf:{
      D:{labels:['00-06','06-12','12-18','18-24'],data:[58,72,85,65],agg:'Avg per 6-hr block'},
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[62,68,72,65,74,70,60],agg:'Daily resting avg'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[68,66,65,64],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[70,69,68,67,66,65,64,65,66,67,68,70],agg:'Monthly avg'},
    }},
  'SpO2':{datatypeCategory:'Continuous data',unit:'%',y0:80,yMax:100,dynamicBounds:true,integerOnly:true,goal:95,goalLabel:'≥95%',
    zones:[{upper:90,l:'Hypoxemia'},{upper:94,l:'Low'},{upper:96,l:'Below Normal'},{upper:Infinity,l:'Normal'}],
    tf:{
      D:{labels:['00-06','06-12','12-18','18-24'],data:[97,98,97,96],agg:'Avg per block'},
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[97,98,97,96,98,97,98],agg:'Daily avg'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[97,97,98,97],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[97,97,97,98,98,98,98,98,97,97,97,97],agg:'Monthly avg'},
    }},
  'Body Temperature':{datatypeCategory:'Continuous data',unit:'°C',y0:34,yMax:42,dynamicBounds:true,goal:37,goalLabel:'Normal',
    zones:[{upper:35,l:'Hypothermia'},{upper:36.5,l:'Low (below typical)'},{upper:37.5,l:'Normal'},{upper:38,l:'Low-grade Fever'},{upper:39,l:'Fever'},{upper:Infinity,l:'High Fever'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[36.6,36.7,36.8,37.2,36.9,36.7,36.6],agg:'Daily avg'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[36.7,36.8,36.7,36.8],agg:'Weekly avg'},
    }},
  'HRV':{datatypeCategory:'Continuous data',unit:'ms',y0:0,yMax:160,dynamicBounds:true,integerOnly:true,
    zones:[{upper:20,l:'Very Low'},{upper:50,l:'Low'},{upper:80,l:'Average'},{upper:120,l:'Good'},{upper:Infinity,l:'Excellent'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[45,52,48,60,55,62,58],agg:'Overnight reading'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[52,56,58,60],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[45,47,50,52,55,58,60,62,60,58,52,48],agg:'Monthly avg'},
    }},
  'Waist Circumference':{datatypeCategory:'Continuous data',unit:'cm',y0:40,yMax:140,dynamicBounds:true,integerOnly:true,
    zones:[{upper:80,l:'Low Risk (F)'},{upper:88,l:'High Risk (F)'},{upper:94,l:'Low Risk (M)'},{upper:102,l:'High Risk (M)'},{upper:Infinity,l:'Very High Risk'}],
    tf:{
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[92,91,90,89],agg:'Weekly reading'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[92,91,90,89,88,87,86,86,87,88,89,90],agg:'Monthly avg'},
    }},
  'Respiratory Rate':{datatypeCategory:'Continuous data',unit:'br/min',y0:6,yMax:40,dynamicBounds:true,integerOnly:true,
    zones:[{upper:8,l:'Bradypnea'},{upper:12,l:'Low Normal'},{upper:21,l:'Normal'},{upper:25,l:'Mildly Elevated'},{upper:Infinity,l:'Tachypnea'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[14,15,16,14,15,14,13],agg:'Overnight avg'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[14,15,14,14],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[15,15,14,14,14,13,13,14,14,15,15,16],agg:'Monthly avg'},
    }},
  'Blood Pressure':{datatypeCategory:'Continuous data',unit:'mmHg',y0:40,yMax:180,dynamicBounds:true,integerOnly:true,goal:120,goalLabel:'Normal SYS <120',
    paired:true,seriesLabels:['Systolic','Diastolic'],
    zones:[{upper:90,l:'Hypotension'},{upper:120,l:'Normal'},{upper:130,l:'Elevated'},{upper:140,l:'Stage 1 HT'},{upper:180,l:'Stage 2 HT'},{upper:Infinity,l:'Hypertensive Crisis'}],
    tf:{
      D:{labels:['Morning','Midday','Evening'],data:[118,122,116],data2:[76,82,74],agg:'Per reading'},
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[115,120,118,122,119,116,114],data2:[74,78,76,80,77,75,72],agg:'Daily avg'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[120,118,116,119],data2:[78,76,75,77],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[122,120,118,116,115,114,113,114,116,118,120,121],data2:[80,78,76,75,74,73,72,73,75,76,78,79],agg:'Monthly avg'},
    }},
  'Sleep Duration':{datatypeCategory:'Continuous data',unit:'h',y0:0,yMax:12,goal:8,goalLabel:'NSF 7-9h',
    zones:[{upper:5,l:'Severely Insufficient'},{upper:6,l:'Insufficient'},{upper:7,l:'Below Recommended'},{upper:9,l:'Optimal'},{upper:10,l:'Slightly Excessive'},{upper:Infinity,l:'Excessive'}],
    tf:{
      W:{labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],data:[7.5,6.5,7,6,5.5,9,8.5],agg:'Nightly total'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[7.2,6.8,7.5,7],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[7.5,7.3,7,6.8,6.5,6.2,6,6.3,6.8,7,7.3,7.5],agg:'Monthly avg'},
    }},
  'Sleep Score':{datatypeCategory:'Ordinal',unit:'score',y0:0,yMax:100,goal:75,goalLabel:'Very Good ≥75',
    zones:[{upper:40,l:'Poor'},{upper:60,l:'Fair'},{upper:75,l:'Good'},{upper:90,l:'Very Good'},{upper:Infinity,l:'Excellent'}],
    tf:{
      W:{labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],data:[72,65,70,58,55,85,80],agg:'Nightly score'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[70,68,74,71],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[74,72,70,68,66,64,62,65,68,70,72,74],agg:'Monthly avg'},
    }},
  'Blood Glucose':{datatypeCategory:'Continuous data',unit:'mmol/L',y0:2.2,yMax:22.2,dynamicBounds:true,goal:5.6,goalLabel:'Normal <5.6',
    zones:[{upper:3.9,l:'Hypoglycemia'},{upper:5.6,l:'Normal (Fasting)'},{upper:7.0,l:'Pre-diabetic'},{upper:7.8,l:'Normal (Post-meal)'},{upper:11.1,l:'Impaired Glucose Tolerance'},{upper:Infinity,l:'Diabetic Range'}],
    tf:{
      D:{labels:['Fasting','Post-B','Post-L','Post-D'],data:[5.1,8.1,7.2,6.6],agg:'Per reading'},
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[5.2,5.3,5.1,5.6,5.4,5.3,5.2],agg:'Fasting daily'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[5.3,5.4,5.2,5.3],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[5.4,5.3,5.3,5.2,5.2,5.1,5.1,5.1,5.2,5.3,5.4,5.5],agg:'Monthly avg'},
    }},
  'HbA1c':{datatypeCategory:'Continuous data',unit:'%',y0:4,yMax:14,dynamicBounds:true,goal:6.5,goalLabel:'Pre-diabetic threshold',
    zones:[{upper:5.7,l:'Normal'},{upper:6.5,l:'Pre-diabetic'},{upper:7,l:'Diabetic (Managed)'},{upper:8,l:'Diabetic'},{upper:Infinity,l:'Poorly Managed'}],
    tf:{
      Y:{labels:['Q1','Q2','Q3','Q4'],data:[6.5,6.2,6.0,5.8],agg:'Quarterly test'},
    }},
  'Mood':{datatypeCategory:'Ordinal',unit:'score',y0:0,yMax:10,goal:7,goalLabel:'Good ≥7',
    zones:[{upper:3,l:'Very Bad'},{upper:5,l:'Bad'},{upper:7,l:'Neutral'},{upper:9,l:'Good'},{upper:Infinity,l:'Excellent'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[7,5,6,7,8,9,8],agg:'Daily avg log'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[6.5,7,7.5,7.2],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[6,6.5,7,7.5,8,8,7.5,7,6.5,6,5.5,6],agg:'Monthly avg'},
    }},
  'Stress':{datatypeCategory:'Ordinal',unit:'score',y0:0,yMax:10,goal:4,goalLabel:'Low ≤4',goalInvert:true,
    zones:[{upper:3,l:'Very Low'},{upper:5,l:'Low'},{upper:7,l:'Moderate'},{upper:9,l:'High'},{upper:Infinity,l:'Extreme'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[2,6,7,6,7,5,2],agg:'Daily avg log'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[5,6,4,4],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[6,6,5,5,4,4,4,4,5,5,6,7],agg:'Monthly avg'},
    }},
  'Anxiety (GAD-7)':{datatypeCategory:'Ordinal',unit:'score',y0:0,yMax:6,goal:2,goalLabel:'Minimal ≤2',goalInvert:true,
    zones:[{upper:5,l:'Minimal'},{upper:10,l:'Mild'},{upper:15,l:'Moderate'},{upper:Infinity,l:'Severe'}],
    tf:{
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[2,3,2,1],agg:'Per assessment'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[3,3,2,2,2,1,1,2,2,2,3,4],agg:'Monthly avg'},
    }},
  'Pain':{datatypeCategory:'Ordinal',unit:'score',y0:0,yMax:10,goal:3,goalLabel:'Mild ≤3',goalInvert:true,
    zones:[{upper:1,l:'No Pain'},{upper:4,l:'Mild Pain'},{upper:7,l:'Moderate Pain'},{upper:10,l:'Severe Pain'},{upper:Infinity,l:'Worst Possible'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[3,5,6,4,5,3,2],agg:'Daily avg'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[5,4,3,3],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[6,5,5,4,4,3,3,3,4,4,5,6],agg:'Monthly avg'},
    }},
  'Water Intake':{datatypeCategory:'Discrete data',unit:'mL',y0:0,yMax:3000,goal:2500,goalLabel:'2,500 mL goal',
    zones:[{upper:500,l:'Severely Low'},{upper:1000,l:'Low'},{upper:1500,l:'Below Target'},{upper:2200,l:'Approaching Goal'},{upper:3500,l:'Goal Met'},{upper:Infinity,l:'High'}],
    tf:{
      D:{labels:['00-06','06-12','12-18','18-24'],data:[200,800,900,600],agg:'Per block'},
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[2200,2600,2400,1800,2700,2500,2100],agg:'Daily total'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[2300,2500,2400,2600],agg:'Daily avg per week'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[2000,2000,2200,2300,2500,2800,3000,2900,2500,2200,2000,1900],agg:'Daily avg per month'},
    }},
  'Medication Adherence':{datatypeCategory:'Special (Boolean → %)',unit:'%',y0:0,yMax:100,goal:90,goalLabel:'≥90%',
    zones:[{upper:50,l:'Non-adherent'},{upper:80,l:'Partially Adherent'},{upper:90,l:'Adherent (WHO min)'},{upper:Infinity,l:'Highly Adherent'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[100,100,50,100,100,100,100],agg:'% doses taken'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[95,88,92,100],agg:'Weekly adherence %'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[92,88,95,90,94,98,96,92,90,88,85,91],agg:'Monthly adherence %'},
    }},
  'Smoking':{datatypeCategory:'Discrete data',unit:'cig/day',y0:0,yMax:20,goal:0,goalLabel:'0 cig target',goalInvert:true,
    zones:[{upper:1,l:'Non-smoker'},{upper:6,l:'Light Smoker'},{upper:11,l:'Moderate Smoker'},{upper:21,l:'Heavy Smoker'},{upper:Infinity,l:'Very Heavy Smoker'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[5,8,10,9,10,12,6],agg:'Daily total'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[10,9,8,7],agg:'Daily avg per week'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[12,11,10,9,9,8,8,7,7,6,6,5],agg:'Daily avg per month'},
    }},
  'Alcohol':{datatypeCategory:'Discrete data',unit:'drinks/day',y0:0,yMax:14,goal:2,goalLabel:'≤2 drinks',goalInvert:true,
    zones:[{upper:1,l:'None'},{upper:2,l:'Low Risk (F)'},{upper:3,l:'Low Risk (M)'},{upper:5,l:'Moderate Risk (F)'},{upper:7,l:'Moderate Risk (M)'},{upper:Infinity,l:'High / Very High Risk'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[1,0,1,0,2,4,3],agg:'Daily total'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[1.5,1,2,1.5],agg:'Daily avg per week'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[2,1.5,1,1,1,2,3,2.5,1.5,1,1.5,3],agg:'Monthly avg'},
    }},
  'Cycle Length':{datatypeCategory:'Continuous data',unit:'days',y0:15,yMax:45,goal:28,goalLabel:'28-day avg',
    zones:[{upper:24,l:'Short (Polymenorrhea)'},{upper:39,l:'Normal'},{upper:Infinity,l:'Long (Oligomenorrhea)'}],
    tf:{
      Y:{labels:['Cy1','Cy2','Cy3','Cy4','Cy5','Cy6','Cy7','Cy8','Cy9','Cy10','Cy11','Cy12'],data:[28,30,27,29,28,31,26,28,29,27,28,30],agg:'Per cycle'},
    }},
  'Period Duration':{datatypeCategory:'Continuous data',unit:'days',y0:0,yMax:10,
    zones:[{upper:2,l:'Very Short'},{upper:4,l:'Short'},{upper:9,l:'Normal'},{upper:Infinity,l:'Menorrhagia Risk'}],
    tf:{
      Y:{labels:['Cy1','Cy2','Cy3','Cy4','Cy5','Cy6'],data:[5,4,5,6,5,5],agg:'Per cycle'},
    }},
  'Cycle Symptoms':{datatypeCategory:'Ordinal',unit:'severity',y0:0,yMax:10,
    zones:[{upper:1,l:'None'},{upper:4,l:'Mild'},{upper:7,l:'Moderate'},{upper:10,l:'Severe'},{upper:Infinity,l:'Extreme'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[0,2,5,6,4,2,0],agg:'Daily avg severity'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[1,4,3,1],agg:'Weekly avg severity'},
    }},
  'RPE':{datatypeCategory:'Ordinal',unit:'score',y0:6,yMax:20,
    zones:[{upper:9,l:'Very Light'},{upper:11,l:'Very Light+'},{upper:13,l:'Light'},{upper:15,l:'Somewhat Hard'},{upper:17,l:'Hard'},{upper:19,l:'Very Hard'},{upper:Infinity,l:'Maximum Effort'}],
    tf:{
      W:{labels:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],data:[0,12,14,0,15,13,0],agg:'Per session'},
      M:{labels:['Wk1','Wk2','Wk3','Wk4'],data:[12,13,14,15],agg:'Weekly avg'},
      Y:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],data:[12,12,13,13,14,14,15,14,14,13,12,12],agg:'Monthly avg'},
    }},
};

const SEX_ZONES = {
  'VO2max': {
    F:[{upper:28,l:'Very Poor'},{upper:34,l:'Poor'},{upper:39,l:'Fair'},{upper:46,l:'Good'},{upper:53,l:'Excellent'},{upper:Infinity,l:'Superior'}],
    M:[{upper:33,l:'Very Poor'},{upper:39,l:'Poor'},{upper:44,l:'Fair'},{upper:53,l:'Good'},{upper:59,l:'Excellent'},{upper:Infinity,l:'Superior'}],
  },
  'Heart Rate': {
    F:[{upper:50,l:'Athletic Bradycardia'},{upper:60,l:'Excellent'},{upper:70,l:'Good'},{upper:80,l:'Average'},{upper:100,l:'Below Average'},{upper:Infinity,l:'Tachycardia'}],
    M:[{upper:40,l:'Athletic Bradycardia'},{upper:60,l:'Excellent'},{upper:70,l:'Good'},{upper:80,l:'Average'},{upper:100,l:'Below Average'},{upper:Infinity,l:'Tachycardia'}],
  },
  'Waist Circumference': {
    F:[{upper:80,l:'Low Risk'},{upper:88,l:'High Risk'},{upper:Infinity,l:'Very High Risk'}],
    M:[{upper:94,l:'Low Risk'},{upper:102,l:'High Risk'},{upper:Infinity,l:'Very High Risk'}],
  },
  'Water Intake': {
    F:[{upper:500,l:'Severely Low'},{upper:1000,l:'Low'},{upper:1500,l:'Below Target'},{upper:2200,l:'Approaching Goal'},{upper:3500,l:'Goal Met'},{upper:Infinity,l:'High'}],
    M:[{upper:500,l:'Severely Low'},{upper:1000,l:'Low'},{upper:1500,l:'Below Target'},{upper:2500,l:'Approaching Goal'},{upper:3500,l:'Goal Met'},{upper:Infinity,l:'High'}],
  },
  'Alcohol': {
    F:[{upper:1,l:'None'},{upper:2,l:'Low Risk'},{upper:4,l:'Moderate Risk'},{upper:6,l:'High Risk'},{upper:Infinity,l:'Very High Risk'}],
    M:[{upper:1,l:'None'},{upper:3,l:'Low Risk'},{upper:5,l:'Moderate Risk'},{upper:7,l:'High Risk'},{upper:Infinity,l:'Very High Risk'}],
  },
};

const SEX_METRICS = new Set(Object.keys(SEX_ZONES));

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function fmtN(n) {
  n = +n;
  if (isNaN(n)) return '—';
  if (n >= 1000000) return (n/1000000).toFixed(1).replace(/\.0$/,'') + 'M';
  if (n >= 1000 && n%1000 === 0) return (n/1000) + 'k';
  if (n >= 10000) return n.toLocaleString();
  if (n === Math.round(n)) return String(Math.round(n));
  return +n.toFixed(2) + '';
}

function computeYAxis(peak, y0, rangeHint, integerOnly) {
  if (peak <= y0) peak = y0 + 1;
  const magBase = rangeHint != null ? Math.max(rangeHint, 0.1) : Math.max(peak, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(magBase)));
  for (const mult of NICE) {
    const interval = +(mult * mag).toFixed(10);
    if (interval <= 0) continue;
    if (integerOnly && Math.round(interval) !== interval) continue;
    const tickStart = rangeHint != null ? Math.floor(y0/interval)*interval : 0;
    const ceil = Math.ceil(peak/interval)*interval;
    const all = [];
    for (let t=tickStart; t<=ceil+interval*0.0001; t=+(t+interval).toFixed(10)) all.push(+t.toFixed(10));
    const vis = all.filter(t => t >= y0 - 1e-9);
    if (vis.length >= 3 && vis.length <= 5) return {interval, ceil, all, vis, mag, mult};
  }
  const fallbackRange = rangeHint != null ? rangeHint : peak;
  const interval = Math.max(Math.ceil(fallbackRange/4), 0.1);
  const tickStart = rangeHint != null ? Math.floor(y0/interval)*interval : 0;
  const ceil = Math.ceil(peak/interval)*interval;
  const all = [];
  for (let t=tickStart; t<=ceil+interval*0.001; t+=interval) all.push(+t.toFixed(10));
  const vis = all.filter(t => t >= y0 - 1e-9);
  return {interval, ceil, all, vis, mag, mult:'fallback'};
}

function getZoneIdx(v, zones) {
  for (let i=0; i<zones.length; i++) {
    if (zones[i].upper !== undefined) { if (v < zones[i].upper) return i; }
    else { if (v <= zones[i].max) return i; }
  }
  return zones.length - 1;
}
function getZoneColor(v, zones) { return ZONE_COLORS[Math.min(getZoneIdx(v,zones), ZONE_COLORS.length-1)]; }
function getZoneBg(v, zones)    { return ZONE_BG[Math.min(getZoneIdx(v,zones), ZONE_BG.length-1)]; }

function zBound(z, yMax) { return z.upper !== undefined ? z.upper : (z.max !== undefined ? z.max + 0.001 : yMax); }
function zPrev(zones, i, y0) { return i > 0 ? zBound(zones[i-1]) : y0; }
function zLabel(z, i, zones) {
  if (z.upper !== undefined) {
    return i === zones.length-1
      ? `≥ ${fmtN(zones[i-1]?.upper ?? 0)}`
      : `< ${fmtN(z.upper)}`;
  }
  return `≤ ${fmtN(z.max)}`;
}

// ─── Core chart computation ───────────────────────────────────────────────────

function computeChart(metricKey, tf, peakInput, peakInput2, sex) {
  let m = METRICS[metricKey];
  const tfd = m.tf[tf];
  if (!tfd) return null;

  const rawData  = tfd.data.map(Number);
  const rawData2 = tfd.data2 ? tfd.data2.map(Number) : null;
  if (SEX_ZONES[metricKey]) m = { ...m, zones: SEX_ZONES[metricKey][sex] };

  const peakOverride  = parseFloat(peakInput);
  const peakOverride2 = parseFloat(peakInput2);

  const dataPeak1 = Math.max(...rawData);
  const dataPeak2 = rawData2 ? Math.max(...rawData2) : null;

  const peak1 = (!isNaN(peakOverride)  && peakOverride  > 0) ? Math.min(peakOverride,  m.yMax) : Math.min(dataPeak1, m.yMax);
  const peak2 = rawData2
    ? ((!isNaN(peakOverride2) && peakOverride2 > 0) ? Math.min(peakOverride2, m.yMax) : Math.min(dataPeak2, m.yMax))
    : null;

  // y-axis is shared — base it on the higher of both peaks
  const peak = rawData2 ? Math.max(peak1, peak2) : peak1;
  const dataPeak = rawData2 ? Math.max(dataPeak1, dataPeak2) : dataPeak1;

  const scaledForBounds = rawData.map(v => {
    if (m.dynamicBounds) { const shift = dataPeak1 - peak1; return v - shift; }
    return dataPeak1 > 0 ? v * (peak1 / dataPeak1) : v;
  });
  const scaledForBounds2 = rawData2 ? rawData2.map(v => {
    if (m.dynamicBounds) { const shift = dataPeak2 - peak2; return v - shift; }
    return dataPeak2 > 0 ? v * (peak2 / dataPeak2) : v;
  }) : null;

  let effectiveY0 = m.y0;
  let effectiveYMax = m.yMax;
  if (m.dynamicBounds) {
    const sMin = Math.min(...scaledForBounds);
    const sMax = Math.max(...scaledForBounds);
    const sRange = sMax - sMin;
    const noiseFloor = sMax * 0.015;
    const buffer = Math.round(Math.max(sRange * 0.5, noiseFloor, 1) * 10) / 10;
    const bufferAbove = Math.round(buffer * 0.5 * 10) / 10;
    effectiveY0  = sMin - buffer;
    effectiveYMax = sMax + bufferAbove;
  }

  const rangeHint0 = m.dynamicBounds ? (effectiveYMax - effectiveY0) : null;
  const firstPass = computeYAxis(m.dynamicBounds ? effectiveYMax : peak, effectiveY0, rangeHint0, m.integerOnly);
  if (m.dynamicBounds) {
    effectiveY0   = Math.floor(effectiveY0   / firstPass.interval) * firstPass.interval;
    effectiveYMax = Math.ceil(effectiveYMax  / firstPass.interval) * firstPass.interval;
  }

  const rangeHint = m.dynamicBounds ? (effectiveYMax - effectiveY0) : null;
  const { interval, ceil, all, vis } = computeYAxis(
    m.dynamicBounds ? effectiveYMax : peak,
    effectiveY0, rangeHint, m.integerOnly
  );
  const visRange = ceil - effectiveY0;

  const dc = m.datatypeCategory || '—';
  const dcCfg = DC_CONFIG[dc] || { border:'#888780', bg:'#F1EFE8', color:'#444441', desc:'' };
  const zi = getZoneIdx(peak, m.zones);

  // Formulas
  const isBounded = m.dynamicBounds;
  const fmtVal = v => (m.dynamicBounds && !m.integerOnly) ? v.toFixed(1) : fmtN(v);
  const rangeHintVal = isBounded ? (effectiveYMax - effectiveY0) : null;
  const magBase = rangeHintVal != null ? Math.max(rangeHintVal, 0.1) : Math.max(peak, 1);
  const magComputed = Math.pow(10, Math.floor(Math.log10(magBase)));
  const niceMultiplier = interval / magComputed;

  const formulas = [];
  if (isBounded) {
    const sMin = Math.min(...scaledForBounds);
    const sMax = Math.max(...scaledForBounds);
    const sRange = sMax - sMin;
    const nf = sMax * 0.015;
    const buf = Math.round(Math.max(sRange * 0.5, nf, 1) * 10) / 10;
    const bufA = Math.round(buf * 0.5 * 10) / 10;
    formulas.push({
      title:'Step 0 — Dynamic bounds',
      raw:'buffer      = max( range×0.5,  peak×1.5%,  1 )\nbufferAbove = buffer × 0.5\ny0   = min(data) − buffer\nyMax = max(data) + bufferAbove\n→ snap both to interval multiples',
      filled:`data range  = ${fmtVal(sMax)} − ${fmtVal(sMin)} = ${fmtVal(sRange)}\nnoise floor = ${fmtVal(sMax)} × 1.5% = ${nf.toFixed(3)}\nbuffer      = max(${fmtVal(sRange*0.5)}, ${nf.toFixed(3)}, 1) = ${buf}\nbufferAbove = ${buf} × 0.5 = ${bufA}\nraw y0   = ${fmtVal(sMin)} − ${buf} = ${fmtVal(sMin-buf)} → snapped = ${fmtN(effectiveY0)}\nraw yMax = ${fmtVal(sMax)} + ${bufA} = ${fmtVal(sMax+bufA)} → snapped = ${fmtN(effectiveYMax)}`,
      result:`y0 = ${fmtN(effectiveY0)}  ·  yMax = ${fmtN(effectiveYMax)}`,
      note:'asymmetric: full buffer below, half above',
    });
  }
  formulas.push(
    {
      title:'Step 1 — Magnitude',
      raw:`magnitude = 10 ^ floor( log10( ${isBounded ? 'range_hint' : 'peak'} ) )`,
      filled:`magnitude = 10 ^ floor( log10( ${fmtN(magBase)} ) )\n         = 10 ^ floor( ${Math.log10(magBase).toFixed(3)} )\n         = 10 ^ ${Math.floor(Math.log10(magBase))}\n         = ${fmtN(magComputed)}`,
      result:`magnitude = ${fmtN(magComputed)}`,
      note: isBounded
        ? `range-based (yMax − y0 = ${fmtN(effectiveYMax)} − ${fmtN(effectiveY0)} = ${fmtN(rangeHintVal?.toFixed(2))})`
        : 'peak-based',
    },
    {
      title:'Step 2 — Nice interval',
      raw:'candidates = NICE × magnitude\npick first where 3 ≤ visible_ticks ≤ 5',
      filled:`candidates = [1, 1.5, 2 …] × ${fmtN(magComputed)}\nchosen multiplier = ${niceMultiplier}\ninterval = ${niceMultiplier} × ${fmtN(magComputed)}`,
      result:`interval = ${fmtN(interval)}`,
      note:`first candidate producing ${vis.length} visible ticks`,
    },
    {
      title:'Step 3 — Ceiling',
      raw:'ceiling = ceil( peak / interval ) × interval',
      filled:`ceiling = ceil( ${fmtN(isBounded ? effectiveYMax : peak)} / ${fmtN(interval)} ) × ${fmtN(interval)}\n        = ceil( ${(((isBounded ? effectiveYMax : peak) / interval)).toFixed(4)} ) × ${fmtN(interval)}\n        = ${Math.ceil((isBounded ? effectiveYMax : peak) / interval)} × ${fmtN(interval)}`,
      result:`ceiling = ${fmtN(ceil)}`,
      note: isBounded ? `based on effectiveYMax = ${fmtN(effectiveYMax)}` : 'based on peak',
    },
    {
      title:'Step 4 — Ticks',
      raw:'all_ticks  = [0, interval, 2×interval … ceiling]\nshown = all_ticks.filter(t ≥ y0)',
      filled:`all_ticks  = [${all.map(fmtN).join(', ')}]\ny0 = ${fmtN(effectiveY0)}\nshown = [${vis.map(fmtN).join(', ')}]`,
      result:`${vis.length} ticks shown`,
      note: isBounded ? `ticks start from snapped y0 = ${fmtN(effectiveY0)}` : 'ticks start from 0, filter ≥ y0',
    }
  );

  return { m, tfd, rawData, rawData2, scaledData: scaledForBounds, scaledData2: scaledForBounds2,
           peak, peak1, peak2, ceil, vis, effectiveY0, effectiveYMax,
           interval, all, visRange, zi, dc, dcCfg, formulas, isBounded, fmtVal };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Simulator() {
  const metricKeys = Object.keys(METRICS);
  const [metricKey, setMetricKey]   = useState(metricKeys[0]);
  const [tf, setTf]                 = useState('W');
  const [peakInput, setPeakInput]   = useState('');
  const [peakInput2, setPeakInput2] = useState('');
  const [sex, setSex]               = useState('F');

  const tfOptions = Object.keys(METRICS[metricKey].tf);

  useEffect(() => {
    const tfs = Object.keys(METRICS[metricKey].tf);
    setTf(tfs.includes('W') ? 'W' : tfs[0]);
    setPeakInput('');
    setPeakInput2('');
  }, [metricKey]);

  const chart = useMemo(
    () => computeChart(metricKey, tf, peakInput, peakInput2, sex),
    [metricKey, tf, peakInput, peakInput2, sex]
  );

  if (!chart) return null;
  const { m, tfd, rawData, rawData2, scaledData, scaledData2, peak, peak1, peak2, ceil, vis, effectiveY0, effectiveYMax,
          interval, all, visRange, zi, dc, dcCfg, formulas, isBounded, fmtVal } = chart;

  const algoText = `Peak ${fmtN(peak)} → magnitude ${fmtN(Math.pow(10,Math.floor(Math.log10(Math.max(peak,1)))))} → interval ${fmtN(interval)} → ceiling ${fmtN(ceil)}`;
  const algoSub  = `All ticks from 0: ${all.map(fmtN).join(' ')} — showing ticks ≥ ${fmtN(effectiveY0)}`;

  return (
    <>
      <h1>Thryve — Health Metric Chart Simulator</h1>
      <p className="sub">All 33 trackers · Y-axis dynamic (3–5 clean ticks) · Zones from Nubo Metrics spec (col N/O)</p>

      {/* ── Controls ── */}
      <div className="top">
        <div className="field" style={{flex:2,minWidth:200}}>
          <label>Metric</label>
          <select value={metricKey} onChange={e => setMetricKey(e.target.value)}>
            {metricKeys.map(k => (
              <option key={k} value={k}>
                {(DC_PREFIX[METRICS[k].datatypeCategory] || '○ ') + k}
              </option>
            ))}
          </select>
          <div style={{marginTop:5,display:'flex',alignItems:'center',gap:6}}>
            <span style={{width:8,height:8,borderRadius:'50%',flexShrink:0,display:'inline-block',background:dcCfg.border}}/>
            <span style={{fontSize:11,color:'#888780'}}>{dc}</span>
          </div>
        </div>

        <div className="field">
          <label>Timeframe</label>
          <select value={tf} onChange={e => setTf(e.target.value)}>
            {tfOptions.map(t => (
              <option key={t} value={t}>
                {{D:'Daily',W:'Weekly',M:'Monthly',Y:'Yearly'}[t] || t}
              </option>
            ))}
          </select>
        </div>

        {m.paired ? (
          <>
            <div className="field">
              <label>Systolic peak</label>
              <input type="number" value={peakInput} placeholder="auto"
                onChange={e => setPeakInput(e.target.value)} />
            </div>
            <div className="field">
              <label>Diastolic peak</label>
              <input type="number" value={peakInput2} placeholder="auto"
                onChange={e => setPeakInput2(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="field">
            <label>Peak override</label>
            <input type="number" value={peakInput} placeholder="auto"
              onChange={e => setPeakInput(e.target.value)} />
          </div>
        )}

        {SEX_METRICS.has(metricKey) && (
          <div className="field">
            <label>Sex</label>
            <div className="seg-ctrl">
              <button className={`seg${sex==='F'?' active':''}`} onClick={() => setSex('F')}>Female</button>
              <button className={`seg${sex==='M'?' active':''}`} onClick={() => setSex('M')}>Male</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Card ── */}
      <div className="card">

        {/* DC banner */}
        <div style={{borderRadius:8,padding:'10px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:12,
                     borderLeft:`4px solid ${dcCfg.border}`,background:dcCfg.bg}}>
          <div>
            <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:500,marginBottom:2,color:dcCfg.color,opacity:.7}}>
              Datatype category
            </div>
            <div style={{fontSize:13,fontWeight:500,color:dcCfg.color}}>{dc}</div>
            <div style={{fontSize:11,marginTop:2,color:dcCfg.color,opacity:.8,lineHeight:1.4}}>{dcCfg.desc}</div>
          </div>
        </div>

        {/* KPIs */}
        <div className="kpis">
          <div className="kpi">
            <div className="kpi-l">{m.paired ? 'Peak (SYS / DIA)' : 'Peak'}</div>
            <div className="kpi-v">
              {m.paired ? `${fmtN(peak1)} / ${fmtN(peak2)}` : fmtN(peak)}
            </div>
            <div className="kpi-s">{m.unit}</div>
          </div>
          <div className="kpi">
            <div className="kpi-l">Ceiling</div>
            <div className="kpi-v">{fmtN(ceil)}</div>
            <div className="kpi-s">snapped from {fmtN(interval)} interval</div>
          </div>
          <div className="kpi">
            <div className="kpi-l">Ticks shown</div>
            <div className="kpi-v">{vis.length}</div>
            <div className="kpi-s">of {vis.length} ticks · from {fmtN(effectiveY0)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-l">Zone (peak)</div>
            <div className="kpi-v" style={{fontSize:14,color:ZONE_COLORS[Math.min(zi,ZONE_COLORS.length-1)]}}>
              {m.zones[zi].l}
            </div>
            <div className="kpi-s">{tfd.agg}</div>
          </div>
        </div>

        {/* Chart */}
        <div className="section-title">Chart</div>
        {m.paired && (
          <div className="series-legend">
            <div className="series-item">
              <div className="series-swatch" style={{background:ZONE_BG[1],border:`2px solid ${ZONE_COLORS[1]}`}} />
              Systolic
            </div>
            <div className="series-item">
              <div className="series-swatch" style={{background:'#E6F1FB',border:'2px solid #378ADD'}} />
              Diastolic
            </div>
          </div>
        )}
        <div className="chart-wrap">
          {/* Y axis */}
          <div className="y-axis">
            {[...vis].reverse().map((t,i) => (
              <span key={i} className="y-tick">{fmtN(t)}</span>
            ))}
          </div>

          {/* Chart body */}
          <div className="chart-body">
            {/* Gridlines */}
            <div className="gridlines">
              {vis.map((t,i) => {
                const pct = visRange > 0 ? (1 - (t - effectiveY0) / visRange) * 100 : 0;
                return <div key={i} className="gridline" style={{top:`${pct.toFixed(2)}%`}} />;
              })}
            </div>

            {/* Bars */}
            <div className="bars-row">
              {scaledData.map((v,i) => {
                const frac      = visRange > 0 ? Math.max(0, (v - effectiveY0) / visRange) : 0;
                const heightPct = Math.max(frac * 100, v > effectiveY0 ? 1.5 : 0);
                const color     = getZoneColor(v, m.zones);
                const bg        = getZoneBg(v, m.zones);
                const label     = isBounded && !m.integerOnly ? v.toFixed(1) : fmtN(Math.round(v));

                if (scaledData2) {
                  const v2        = scaledData2[i];
                  const frac2     = visRange > 0 ? Math.max(0, (v2 - effectiveY0) / visRange) : 0;
                  const height2   = Math.max(frac2 * 100, v2 > effectiveY0 ? 1.5 : 0);
                  const label2    = fmtN(Math.round(v2));
                  return (
                    <div key={i} className="bar-wrap">
                      <div className="bar-pair">
                        <div className="bar"
                          style={{height:`${heightPct.toFixed(2)}%`,background:bg,border:`2px solid ${color}`,flex:1}}
                          title={`${tfd.labels[i]} Systolic: ${label} ${m.unit}`}>
                          {frac > 0.08 && <span className="bar-val" style={{color}}>{label}</span>}
                        </div>
                        <div className="bar"
                          style={{height:`${height2.toFixed(2)}%`,background:'#E6F1FB',border:'2px solid #378ADD',flex:1}}
                          title={`${tfd.labels[i]} Diastolic: ${label2} ${m.unit}`}>
                          {frac2 > 0.08 && <span className="bar-val" style={{color:'#185FA5'}}>{label2}</span>}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={i} className="bar-wrap">
                    <div className="bar"
                      style={{height:`${heightPct.toFixed(2)}%`,background:bg,border:`2px solid ${color}`}}
                      title={`${tfd.labels[i]}: ${label} ${m.unit}`}>
                      {frac > 0.08 && (
                        <span className="bar-val" style={{color}}>{label}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Goal line */}
            {m.goal != null && visRange > 0 && (() => {
              const gf = (m.goal - effectiveY0) / visRange;
              if (gf < 0 || gf > 1.05) return null;
              return (
                <div className="goal-line"
                  style={{display:'block',bottom:`${(Math.min(gf,1)*100).toFixed(2)}%`,top:'auto'}}>
                  <span className="goal-tag">{m.goalLabel || fmtN(m.goal)}</span>
                </div>
              );
            })()}

            {/* X labels */}
            <div className="x-labels">
              {tfd.labels.map((l,i) => (
                <span key={i} className="x-label">{l}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Zone reference */}
        <div className="section-title" style={{marginTop:28}}>Zone reference</div>
        <div className="zone-bar">
          {m.zones.map((z,i) => {
            const totalRange = effectiveYMax - effectiveY0;
            const hi = Math.min(zBound(z, effectiveYMax), effectiveYMax);
            const lo = Math.max(zPrev(m.zones, i, effectiveY0), effectiveY0);
            const flex = ((hi - lo) / totalRange * 100).toFixed(2);
            return (
              <div key={i} className="zone-seg"
                style={{flex:flex,background:ZONE_BG[Math.min(i,ZONE_BG.length-1)],borderRight:'1px solid #fff'}} />
            );
          })}
        </div>
        <div className="zones-legend">
          {m.zones.map((z,i) => (
            <div key={i} className="zone-pill">
              <div className="zone-dot" style={{background:ZONE_COLORS[Math.min(i,ZONE_COLORS.length-1)]}} />
              {z.l} ({zLabel(z,i,m.zones)} {m.unit})
            </div>
          ))}
        </div>

        {/* Y-axis calculation */}
        <div className="section-title">Y-axis calculation</div>
        <div className="algo-box">
          <span dangerouslySetInnerHTML={{__html:
            `Peak <code>${fmtN(peak)}</code> → magnitude <code>${fmtN(Math.pow(10,Math.floor(Math.log10(Math.max(peak,1)))))}</code> → interval <code>${fmtN(interval)}</code> → ceiling <code>${fmtN(ceil)}</code><br/>
             All ticks from 0: ${all.map(t=>`<code>${fmtN(t)}</code>`).join(' ')} — showing ticks ≥ <code>${fmtN(effectiveY0)}</code>`
          }} />
        </div>
        <div className="ticks-row">
          {vis.map((t,i) => (
            <span key={i} className={`tick-chip${i===vis.length-1?' top':''}`}>{fmtN(t)}</span>
          ))}
        </div>

        {/* Formulas */}
        <div className="section-title" style={{marginTop:20}}>Formulas</div>
        <div className="formula-grid">
          {formulas.map((f,i) => (
            <div key={i} className="f-card">
              <div className="f-title">{f.title}</div>
              <div className="f-raw" dangerouslySetInnerHTML={{__html:f.raw.replace(/\n/g,'<br/>')}} />
              <div className="f-filled" dangerouslySetInnerHTML={{__html:f.filled.replace(/\n/g,'<br/>')}} />
              <div className="f-result">{f.result}</div>
              {f.note && <div className="f-note">{f.note}</div>}
            </div>
          ))}
        </div>

      </div>
    </>
  );
}
