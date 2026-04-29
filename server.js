
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoDBStore from 'connect-mongodb-session';
import expressLayouts from 'express-ejs-layouts';

const app = express();
const PORT = process.env.PORT || 5000;

// Utilisation de la variable d'environnement définie sur Render ou en local
mongoose.connect(process.env.MONGO_URI || '', { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log("✅ MongoDB Connecté"))
    .catch(err => console.error("❌ Erreur DB :", err.message));

const Product = mongoose.model('Product', new mongoose.Schema({
    name: String,
    price: Number,
    category: String,
    subCategory: String,
    image: String,
    isAffiliate: { type: Boolean, default: true },
    affiliateUrl: String,
    createdAt: { type: Date, default: Date.now, expires: 86400 } 
}));

async function fetchDynamicProducts(keyword) {
    const tag = process.env.AMAZON_TAG || 'carl-20';
    const products = [];
    const simpleKeyword = encodeURIComponent(keyword.split(' ')[0]);
    
    for(let i=1; i<=24; i++) {
        products.push({
            name: `${keyword} - Sélection Spéciale v${i}`,
            price: (Math.random() * 250 + 10).toFixed(2),
            category: "Search",
            subCategory: keyword,
            image: `https://loremflickr.com/400/400/${simpleKeyword}?lock=${i + Math.floor(Math.random() * 100)}`,
            affiliateUrl: `https://www.amazon.ca/s?k=${encodeURIComponent(keyword)}&tag=${tag}`
        });
    }
    return products;
}

const MongoDBStoreSession = MongoDBStore(session);
const store = new MongoDBStoreSession({ uri: process.env.MONGO_URI || '', collection: 'sessions' });

app.use(session({ secret: 'prod_secret_secure', resave: false, saveUninitialized: false, store: store }));
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', async (req, res) => {
    const query = req.query.q;
    let products = [];
    try {
        if (query) {
            products = await Product.find({ subCategory: query });
            if (products.length === 0) {
                const apiResults = await fetchDynamicProducts(query);
                products = await Product.insertMany(apiResults);
            }
        } else {
            products = await Product.find().sort({ createdAt: -1 }).limit(24);
            if (products.length === 0) {
                const trending = await fetchDynamicProducts("Tech");
                products = await Product.insertMany(trending);
            }
        }
        res.render('index', { products, title: 'Boutique Partenaire', searchTerm: query || '' });
    } catch (e) {
        res.render('index', { products: [], title: 'Erreur', searchTerm: '' });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serveur en ligne sur le port ${PORT}`));
