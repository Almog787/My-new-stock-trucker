# 📊 Stock Portfolio Dashboard | לוח בקרה לתיק השקעות

אפליקציית רשת (Web App) אינטראקטיבית למעקב אחר תיק ההשקעות. המערכת מציגה ניתוח ביצועים, הקצאת נכסים בזמן אמת והיסטוריית רווח/הפסד בצורה ויזואלית ומתקדמת.

A modern, interactive web application for tracking your stock portfolio, visualizing performance, asset allocation, and historical P&L.

## ✨ תכונות מרכזיות | Key Features
* **לוח בקרה אינטראקטיבי:** תצוגה מודרנית ונקייה המציגה את כלל ההחזקות.
* **מעקב שווי בזמן אמת:** חישוב עדכני של שווי התיק הכולל על בסיס מחירי המניות.
* **גרפים מתקדמים (Charts):** הצגת פילוח נכסים בגרף עוגה והיסטוריית התיק בגרף קווים.
* **תמיכה מלאה בעברית:** ממשק משתמש מותאם מימין לשמאל (RTL).
* **עיצוב רספונסיבי:** מותאם באופן מלא למכשירים ניידים ומסכי מחשב.

## 🛠️ טכנולוגיות | Tech Stack
* **Frontend:** React 18 + Vite, TypeScript
* **Styling:** Tailwind CSS
* **Charts:** Recharts
* **Icons:** Lucide React

## 🚀 איך להריץ את הפרויקט | How to Run
1. ודאו שמותקן אצלכם Node.js.
2. התקינו את ספריות הפרויקט (Dependencies):
   ```bash
   npm install
   ```
3. הריצו את שרת הפיתוח:
   ```bash
   npm run dev
   ```
4. פתחו את הדפדפן בכתובת המקומית (לרוב `http://localhost:3000`).

## 📁 מבנה הנתונים | Data Structure
האפליקציה קוראת את נתוני התיק בזמן אמת מתיקיית `public/data/`:
* `portfolio.json`: מכיל את פרטי ההחזקות שלכם (כמות מניות ומחיר קנייה ממוצע לכל חברה).
* `stock_history.json`: מכיל את היסטוריית המחירים ההיסטורית לצורך הצגת התפתחות התיק לאורך זמן.

---
📂 *Created by Almog787*