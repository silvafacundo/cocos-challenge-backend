# Cocos Challenge Backend


---

## 1. Configuración e Inicio del Proyecto

### Opción A: Sin Docker (Local)
Para levantar el proyecto en tu entorno local sin usar Docker:

1. **Configurar la Base de Datos**:
   Duplica el archivo `.env.example` como `.env` y actualiza la variable con los valores correspondientes.

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Correr migraciones y seed**:
   ```bash
   npm run migrate
   npm run seed
   ```

4. **Correr en modo dev**:
   ```bash
   npm run dev
   ```

---

### Opción B: Con Docker
Para levantar el proyecto completo de forma automática con Docker Compose:

1. **Iniciar todos los servicios**:
   ```bash
   docker compose up --build -d
   ```
   *Esto compilará la aplicación, creará e iniciará los contenedores de la base de datos y de la aplicación, ejecutará las migraciones y los datos de prueba de forma automática. La aplicación quedará disponible en http://localhost:3000.*

---

## 2. Ejecución de Unit Tests

### Opción A: Sin Docker (Local)
Para correr los tests en local:

1. Asegúrate de tener configurada tu base de datos en el archivo `.env`.
2. Ejecuta el comando de pruebas:
   ```bash
   npm test
   ```

---

### Opción B: Con Docker
Para correr las migraciones, la carga de datos de prueba y los test de forma automática en un contenedor de pruebas aislado y limpio:

1. Ejecuta el siguiente comando:
   ```bash
   docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
   ```