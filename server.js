const express = require ('express');
const path = require ('path');
const mysql = require('mysql2/promise');
const xml2js = require('xml2js');
const { DOMParser } = require('xmldom');
const xpath = require('xpath');

const app = express();
const port = process.env.PORT || 3000;

const dbConfig = {
	host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root', 
    password: process.env.DB_PASSWORD || '', 
    database: process.env.DB_NAME || 'test',
    port: process.env.DB_PORT || 3306,
    decimalNumbers: true,
    ssl: process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : undefined
};

// Funcion para crear una base de datos
async function initializeDatabase() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log(`Conectado a la base de datos: ${dbConfig.database}`);

        // Verificamos si existe la tabla
        const [tables] = await connection.execute("SHOW TABLES LIKE 'productos'");

        if (tables.length === 0) {
            await connection.execute(`
                CREATE TABLE productos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nombre VARCHAR(255) NOT NULL,
                    precio DECIMAL(10, 2) NOT NULL,
                    stock INT NOT NULL,
                    historical_data TEXT
                )
            `);
            console.log('Tabla "productos" creada automáticamente.');
        } else {
            console.log('La tabla ya existe.');
        }
        return connection;
    } catch (err) {
        console.error('Error al conectar a la BD:', err.message);
        throw err;
    }
}

async function connectToDatabase() {
	try {
        	const connection = await mysql.createConnection(dbConfig);
        	console.log('Conectado a la base de datos MySQL.');
        	return connection;
    	} catch (err) {
        	console.error('Error al conectar a la base de datos MySQL:', err.message);
        	process.exit(1);
    	}
}

let dbConnection;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use(async (req, res, next) => {
	if (!dbConnection || dbConnection.state === 'disconnected') {
		dbConnection = await connectToDatabase();
	}
	req.db = dbConnection;
	next();
});

//Rutas Api
//Obtener todos los productos
app.get('/api/productos', async (req, res) => {
	try {
		const [rows] = await req.db.execute("SELECT * FROM productos");
		res.json(rows);
	} catch (err) {
		res.status(500).json({ error: err.message});
	}
});

//Obtener productos por ID
app.get('/api/productos/:id', async (req, res) => {
	const { id } = req.params;
	try {
		const [rows] = await req.db.execute("SELECT * FROM productos WHERE id = ?", [id]);
		const product = rows[0];

		if (!product) {
			return res.status(404).json({ error: 'Producto no encontrado.' });
		}

		let historicalDataParsed = {};
		if (product.historical_data) {

			xml2js.parseString(product.historical_data, { explicitArray: false, mergeAttrs: true }, (err, result) => {
                		if (err) {
                    		console.warn('Error al parsear XML:', err.message);
                    		historicalDataParsed = { raw: product.historical_data, error: 'XML mal formado o error al parsear.' };
                		} else {
                    		historicalDataParsed = result;
                		}
            	});
        	}

		let latestPriceChange = null;
        	if (product.historical_data) {
            	try {
                	const doc = new DOMParser().parseFromString(product.historical_data, 'text/xml');
                	const nodes = xpath.select("//history/price_change[last()]/@date", doc);
                	if (nodes.length > 0) {
                    	latestPriceChange = nodes[0].value;
                	}
            	} catch (e) {
                		console.warn('Error al usar XPath:', e.message);
            	}
        	}
		
		res.json({
			...product,
			historical_data_parser: historicalDataParsed,
			latest_price_change_date_xpath: latestPriceChange
		});
	} catch (err) {
		res.status(500).json({error: err.message});
	}
});

// Añadir Producto
app.post('/api/productos', async (req, res) => {
	const { nombre, precio, stock, historical_data } = req.body;
	
	if (!nombre || precio === undefined || stock === undefined) {
		return res.status(400).json({ error: 'Nombre, precio y stock son campos requeridos' });
	}
	
	try {
		const [result] = await req.db.execute(
			"INSERT INTO productos(nombre, precio, stock, historical_data) VALUES (?, ?, ?, ?)",
			[nombre, precio, stock, historical_data || null]
		);
		res.status(201).json({ id:result.insertId, nombre, precio, stock, historical_data});
    	} catch (err) {
        	res.status(500).json({ error: err.message });
    	}
});

// PUT Actualizar un producto
app.put('/api/productos/:id', async (req, res) => {
    	const { id } = req.params;
    	const { nombre, precio, stock, historical_data } = req.body;

    	if (!nombre || precio === undefined || stock === undefined) {
        	return res.status(400).json({ error: 'Nombre, precio y stock son campos requeridos.' });
    	}

    	try {
        	const [result] = await req.db.execute(
            	"UPDATE productos SET nombre = ?, precio = ?, stock = ?, historical_data = ? WHERE id = ?",
            	[nombre, precio, stock, historical_data || null, id]
        	);
        	if (result.affectedRows === 0) {
            	return res.status(404).json({ error: 'Producto no encontrado.' });
        	}
        	res.json({ message: 'Producto actualizado con éxito.' });
    	} catch (err) {
        	res.status(500).json({ error: err.message });
    	}
});

// DELETE Eliminar un producto
app.delete('/api/productos/:id', async (req, res) => {
    	const { id } = req.params;
    	try {
        	const [result] = await req.db.execute("DELETE FROM productos WHERE id = ?", [id]);
        	if (result.affectedRows === 0) {
            	return res.status(404).json({ error: 'Producto no encontrado.' });
        	}
        	res.status(204).send();
    	} catch (err) {
        	res.status(500).json({ error: err.message });
    	}
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar el servidor
app.listen(port, async () => {
    	console.log(`Accede al catálogo en: http://localhost:${port}`);
    	dbConnection = await initializeDatabase();
});

process.on('SIGINT', async () => {
    	if (dbConnection) {
        	await dbConnection.end();
        	console.log('Conexión a MySQL cerrada.');
    	}
    	process.exit();
});