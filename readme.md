# Cocos Challenge Backend


---
## Desiciones de diseño y arquitectura
En este desarrollo se tomaron libertades prácticas para cumplir los requisitos de este challenge.
Si bien no hay un sistema de autenticación, se puede modificar el usuario al que se está haciendo referencia en cada request utilizanod el header `user-id` seguido del id del usuario. De no especificarse se utilizará el user id 1.

### Portfolio
`GET /portfolio`
Este endpoint devuelve el portfolio del usuario seleccionado.

**Respuesta:**

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `cash_balance` | `number` | Saldo en pesos disponible en la cuenta del usuario. |
| `total_asset_value` | `number` | Valor de mercado total de todos los activos en tenencia del usuario. |
| `total_portfolio_value` | `number` | Valor total del portafolio (efectivo disponible + valor de los activos). |
| `assets` | `array` | Listado de activos en cartera. Cada elemento posee los campos detallados a continuación. |

#### Detalle de cada activo dentro de `assets`:

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `ticker` | `string` | Símbolo identificador del activo (ej. AAPL, GGAL). |
| `name` | `string` | Nombre de la empresa o del instrumento financiero. |
| `type` | `string` | Tipo de instrumento. |
| `price` | `number` | Último precio de mercado de cierre registrado. |
| `size` | `number` | Cantidad total nominal de este activo en cartera. |
| `position_value` | `number` | Valor actual de mercado de la tenencia (`size` * `price`). |
| `absolute_return` | `number` | Ganancia o pérdida monetaria neta absoluta acumulada en este activo. |
| `roi` | `number` | Retorno sobre la inversión expresado en porcentaje (`%`). |

> A la hora de calcular el balance del usuario, se asume que las operaciones de tipo CASH_IN y CASH_OUT son únicamente para pesos. De no ser así, se debe modificar la query que realiza el cálculo.

---

### Búsqueda de Instrumentos
`GET /search`
Permite buscar instrumentos financieros según diferentes criterios de filtro.

**Query Params:**

| Parámetro | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `query` | `string` | No | Filtro general que busca coincidencias parciales en `ticker` o `name`. |
| `type` | `string` | No | Filtra por el tipo de instrumento exacto. |
| `ticker` | `string` | No | Filtra por el símbolo exacto del activo. |
| `name` | `string` | No | Filtra por el nombre del instrumento. |

**Respuesta (Array de objetos):**

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `number` | ID único del instrumento. |
| `ticker` | `string` | Símbolo identificador del activo. |
| `name` | `string` | Nombre del instrumento. |
| `type` | `string` | Tipo de instrumento. |
| `price` | `number` | Último precio de cierre registrado. |
| `open` | `number` | Precio de apertura diario. |
| `close` | `number` | Precio de cierre diario. |
| `high` | `number` | Precio máximo diario. |
| `low` | `number` | Precio mínimo diario. |
| `daily_return` | `number` | Rendimiento diario expresado en porcentaje (`%`). |

---

### Crear Orden
`POST /order`
Permite registrar una nueva orden de compra o venta (de tipo MARKET o LIMIT) para el usuario seleccionado.

**Body:**

| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `ticker` | `string` | Sí | Símbolo identificador del activo a operar (ej. `AAPL`). |
| `type` | `string` | Sí | Tipo de orden: `MARKET` o `LIMIT`. |
| `side` | `string` | Sí | Dirección de la operación: `BUY` o `SELL`. |
| `size` | `number` | Condicional | Cantidad nominal a operar (requerido para `LIMIT` y opcional para `MARKET` si se envía `cashValue`). |
| `bidPrice` | `number` | Condicional | Precio límite por cada unidad (requerido únicamente para órdenes `LIMIT`). |
| `cashValue` | `number` | Condicional | Monto total en pesos a operar (opcional para `MARKET`). |

> Si se utiliza `cashValue` la cantidad de acciones a comprar será aproximada. No se ejecutará el total de `cashValue`.

**Response (Objeto de orden creada):**

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `number` | ID único de la orden creada. |
| `instrumentid` | `number` | ID del instrumento financiero correspondiente. |
| `userid` | `number` | ID del usuario que ejecutó la orden. |
| `size` | `number` | Cantidad total operada en la transacción. |
| `price` | `number` | Precio unitario al que se ejecutó o configuró la orden. |
| `type` | `string` | Tipo de la orden (`MARKET` o `LIMIT`). |
| `side` | `string` | Sentido de la orden (`BUY` o `SELL`). |
| `status` | `string` | Estado final/actual de la orden (`FILLED`, `REJECTED`, `NEW`). |
| `datetime` | `string` | Fecha y hora en formato ISO 8601 del registro de la transacción. |

---

### Cancelar Orden
`DELETE /order/:orderId`
Permite cancelar una orden de tipo `LIMIT` que aún no se haya ejecutado (debe estar en estado `NEW`).

**Parámetros de Ruta (Path Params):**

| Parámetro | Tipo | Descripción |
| :--- | :--- | :--- |
| `orderId` | `number` | ID único de la orden a cancelar. |

**Respuesta (Objeto de orden modificada):**

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `number` | ID único de la orden. |
| `instrumentid` | `number` | ID del instrumento financiero correspondiente. |
| `userid` | `number` | ID del usuario de la orden. |
| `size` | `number` | Cantidad operada de la orden. |
| `price` | `number` | Precio configurado. |
| `type` | `string` | Tipo de la orden. |
| `side` | `string` | Sentido de la orden. |
| `status` | `string` | Nuevo estado de la orden (`CANCELLED`). |
| `datetime` | `string` | Fecha y hora de creación original de la orden. |

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
