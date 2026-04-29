
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoDBStore from 'connect-mongodb-session';
import expressLayouts from 'express-ejs-layouts';

const app = express();
const PORT = process.env.PORT || 5000;

// Connexion MongoDB avec timeout de 5s pour le Flint 2
mongoose.connect(process.env.MONGO_URI || '', { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log("✅ Connecté à MongoDB Atlas"))
    .catch(err => console.error("❌ Erreur de connexion :", err.message));

// Modèle avec TTL (Time To Live) de 24h pour garder les résultats frais
const ProductSchema = new mongoose.Schema({
    name: String,
    price: Number,
    category: String,
    subCategory: String,
    image: String,
    isAffiliate: { type: Boolean, default: true },
    affiliateUrl: String,
    createdAt: { type: Date, default: Date.now, expires: 86400 } 
});

const Product = mongoose.model('Product', ProductSchema);

// Fonction de simulation d'appel API Amazon (Recherche à la demande)
async function fetchDynamicProducts(keyword) {
    console.log(`📡 Récupération de nouveaux produits pour : "${keyword}"`);
    const tag = process.env.AMAZON_TAG || 'carl-20';
    const products = [];
    
    // On génère 24 produits pour remplir une grille de 4x6 ou 3x8
    for(let i=1; i<=24; i++) {
        products.push({
            name: `${keyword} Premium Edition v${i}`,
            price: (Math.random() * 450 + 15).toFixed(2),
            category: "Dynamic Search",
            subCategory: keyword,
            // Utilisation de Lorem Flickr pour des images thématiques stables
            image: `https://loremflickr.com/400/400/${encodeURIComponent(keyword)}?lock=${i}`,
            affiliateUrl: `https://www.amazon.ca/s?k=${encodeURIComponent(keyword)}&tag=${tag}`
        });
    }
    return products;
}

const MongoDBStoreSession = MongoDBStore(session);
const store = new MongoDBStoreSession({ 
    uri: process.env.MONGO_URI || '', 
    collection: 'sessions' 
});

app.use(session({ 
    secret: 'carl_secret_v23', 
    resave: false, 
    saveUninitialized: false, 
    store: store 
}));

app.use(expressLayouts);
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use((req, res, next) => {
    res.locals.searchTerm = req.query.q || '';
    next();
});

// Route Principale : Logique de Recherche JIT (Just-In-Time)
app.get('/', async (req, res) => {
    const query = req.query.q;
    let products = [];

    try {
        if (query) {
            // Étape 1 : Vérifier le cache local
            products = await Product.find({ 
                subCategory: { $regex: new RegExp('^' + query + '$', 'i') } 
            });

            // Étape 2 : Si cache vide, simuler l'appel API
            if (products.length === 0) {
                const apiResults = await fetchDynamicProducts(query);
                products = await Product.insertMany(apiResults);
            }
        } else {
            // Page d'accueil : Affiche les dernières recherches ou du contenu tendance
            products = await Product.find().sort({ createdAt: -1 }).limit(24);
            if (products.length === 0) {
                const trending = await fetchDynamicProducts("Nouveautés");
                products = await Product.insertMany(trending);
            }
        }
        res.render('index', { products, title: 'AmazonClone V23 - Recherche Dynamique' });
    } catch (error) {
        console.error(error);
        res.render('index', { products: [], title: 'Erreur Système' });
    }
});

app.listen(PORT, () => console.log(`🚀 Serveur V23 prêt sur http://localhost:${PORT}`));
