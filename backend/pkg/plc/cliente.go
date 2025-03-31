// pkg/plc/cliente.go
package plc

import (
	"encoding/binary"
	"errors"
	"fmt"
	"log"
	"math"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/robinson/gos7"
)

// Erros específicos para melhorar o tratamento de erros
var (
	ErrConnectionClosed = errors.New("conexão com PLC não inicializada")
	ErrNetworkFailure   = errors.New("falha na conexão de rede com o PLC")
	ErrInvalidDataType  = errors.New("tipo de dados inválido ou não suportado")
	ErrValueConversion  = errors.New("valor não pode ser convertido para o tipo especificado")
)

// Client encapsula a conexão com o PLC e adiciona funcionalidade de reconexão
type Client struct {
	client       gos7.Client
	handler      *gos7.TCPClientHandler
	gateway      string
	useVLAN      bool
	config       ClientConfig // Armazena a configuração para reconexão
	mu           sync.Mutex   // Protege o acesso concorrente ao cliente
	lastConnErr  error        // Último erro de conexão
	lastConnTime time.Time    // Momento da última conexão bem-sucedida
	isConnected  bool         // Estado atual da conexão
}

// ClientConfig representa a configuração de conexão do PLC
type ClientConfig struct {
	IPAddress  string
	Rack       int
	Slot       int
	Timeout    time.Duration
	UseVLAN    bool
	Gateway    string
	SubnetMask string
	VLANID     int
}

// NewClient cria uma nova instância do cliente PLC com suporte a reconexão
func NewClient(ip string, rack, slot int) (*Client, error) {
	config := ClientConfig{
		IPAddress: ip,
		Rack:      rack,
		Slot:      slot,
		Timeout:   10 * time.Second,
	}
	return NewClientWithConfig(config)
}

// NewClientWithConfig cria um cliente com configurações avançadas e suporte a reconexão
func NewClientWithConfig(config ClientConfig) (*Client, error) {
	client := &Client{
		config:      config,
		isConnected: false,
	}

	// Configura o timeout padrão se não especificado
	if config.Timeout == 0 {
		client.config.Timeout = 10 * time.Second
	}

	// Tenta conectar inicialmente
	err := client.connect()
	if err != nil {
		return client, fmt.Errorf("falha ao conectar ao PLC: %w", err)
	}

	return client, nil
}

// connect estabelece a conexão com o PLC
func (c *Client) connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Se já tiver um handler, fecha antes de criar um novo
	if c.handler != nil {
		c.handler.Close()
		c.handler = nil
		c.client = nil
	}

	// Criar novo handler
	handler := gos7.NewTCPClientHandler(c.config.IPAddress, c.config.Rack, c.config.Slot)
	handler.Timeout = c.config.Timeout

	// Tentar estabelecer conexão com retry
	var err error
	maxRetries := 3
	backoffTime := 100 * time.Millisecond

	for i := 0; i < maxRetries; i++ {
		err = handler.Connect()
		if err == nil {
			break
		}

		log.Printf("Falha na tentativa %d de conectar ao PLC %s: %v. Tentando novamente em %v...",
			i+1, c.config.IPAddress, err, backoffTime)

		// Esperar antes de tentar novamente (backoff exponencial)
		time.Sleep(backoffTime)
		backoffTime *= 2
	}

	if err != nil {
		c.lastConnErr = err
		c.isConnected = false
		return fmt.Errorf("falha ao conectar ao PLC após %d tentativas: %w", maxRetries, err)
	}

	// Atualiza o estado da conexão
	c.handler = handler
	c.client = gos7.NewClient(handler)
	c.lastConnTime = time.Now()
	c.isConnected = true
	c.lastConnErr = nil

	// Armazena outras configurações relevantes
	c.gateway = c.config.Gateway
	c.useVLAN = c.config.UseVLAN

	log.Printf("Conectado com sucesso ao PLC %s (Rack: %d, Slot: %d)",
		c.config.IPAddress, c.config.Rack, c.config.Slot)
	return nil
}

// Reconnect força uma reconexão com o PLC
func (c *Client) Reconnect() error {
	log.Printf("Forçando reconexão ao PLC %s", c.config.IPAddress)
	return c.connect()
}

// ensureConnected garante que a conexão esteja ativa antes de qualquer operação
func (c *Client) ensureConnected() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Verificação segura do estado de conexão
	if !c.isConnected || c.handler == nil || c.client == nil {
		// Se a conexão não está OK, tenta reconectar
		c.mu.Unlock()
		err := c.Reconnect()
		c.mu.Lock()
		return err
	}

	return nil
}

// Close fecha a conexão com o PLC
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.handler != nil {
		c.handler.Close()
		c.handler = nil
		c.client = nil
		c.isConnected = false
	}
}

// Ping testa a conectividade com o PLC
func (c *Client) Ping() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Se não temos um handler, a conexão já está inativa
	if c.handler == nil {
		return ErrConnectionClosed
	}

	// Teste 1: Verificar se o socket TCP ainda está vivo
	address := c.handler.Address
	if _, _, err := net.SplitHostPort(address); err != nil {
		address = fmt.Sprintf("%s:102", address)
	}

	conn, err := net.DialTimeout("tcp", address, 3*time.Second)
	if err != nil {
		c.isConnected = false
		return fmt.Errorf("%w: %v", ErrNetworkFailure, err)
	}
	conn.Close()

	// Se chegou aqui, a conexão parece OK
	c.isConnected = true
	return nil
}

// IsConnected retorna o estado atual da conexão
func (c *Client) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.isConnected
}

// GetConfig retorna a configuração atual do cliente
func (c *Client) GetConfig() ClientConfig {
	return c.config
}

// isNetworkError verifica se um erro é relacionado a rede
func isNetworkError(err error) bool {
	if err == nil {
		return false
	}

	// Verificar primeiro se é um erro de rede específico do pacote net
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}

	// Verificar casos específicos por mensagem
	errStr := err.Error()
	networkErrors := []string{
		"connection reset",
		"broken pipe",
		"EOF",
		"forcibly closed",
		"i/o timeout",
		"uso de um arquivo fechado",
		"foi forçado o cancelamento",
		"wsasend",
	}

	for _, errText := range networkErrors {
		if strings.Contains(strings.ToLower(errStr), errText) {
			return true
		}
	}

	return false
}

// ReadTag lê um valor do PLC usando DBNumber, ByteOffset, dataType e BitOffset opcional (para bool)
func (c *Client) ReadTag(dbNumber int, byteOffset int, dataType string, bitOffset int) (interface{}, error) {
	// Garante que a conexão está ativa antes de qualquer operação
	if err := c.ensureConnected(); err != nil {
		return nil, fmt.Errorf("erro de conexão: %w", err)
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	var size int

	// Validação explícita do tipo de dados para evitar interpretação incorreta
	dataType = strings.ToLower(strings.TrimSpace(dataType))

	// Mapear tipos válidos e seus tamanhos
	validTypes := map[string]int{
		"real":   4,
		"dint":   4,
		"int32":  4,
		"dword":  4,
		"uint32": 4,
		"int":    2,
		"int16":  2,
		"word":   2,
		"uint16": 2,
		"sint":   1,
		"int8":   1,
		"usint":  1,
		"byte":   1,
		"uint8":  1,
		"bool":   1,
		"string": 256,
	}

	size, validType := validTypes[dataType]
	if !validType {
		// Se o tipo não for reconhecido, tente inferir um tipo adequado
		log.Printf("AVISO: Tipo de dado não reconhecido: '%s'. Tentando inferir tipo adequado.", dataType)
		if bitOffset > 0 {
			dataType = "bool"
			size = 1
		} else {
			// Padrão para um tipo genérico quando não é possível determinar
			dataType = "word"
			size = 2
		}
	}

	// Ler os bytes do PLC
	buf := make([]byte, size)
	err := c.client.AGReadDB(dbNumber, byteOffset, size, buf)

	// Verificar se tivemos um erro de conexão
	if err != nil {
		if isNetworkError(err) {
			c.isConnected = false
			return nil, fmt.Errorf("%w: DB%d.%d: %v", ErrNetworkFailure, dbNumber, byteOffset, err)
		}
		return nil, fmt.Errorf("erro ao ler dados do PLC (DB%d.%d): %w", dbNumber, byteOffset, err)
	}

	// Interpretar os bytes conforme o tipo de dado
	var resultado interface{}

	switch dataType {
	case "real":
		resultado = math.Float32frombits(binary.BigEndian.Uint32(buf))

	case "dint", "int32":
		resultado = int32(binary.BigEndian.Uint32(buf))

	case "dword", "uint32":
		resultado = binary.BigEndian.Uint32(buf)

	case "int", "int16":
		resultado = int16(binary.BigEndian.Uint16(buf))

	case "word", "uint16":
		resultado = binary.BigEndian.Uint16(buf)

	case "sint", "int8":
		resultado = int8(buf[0])

	case "usint", "byte", "uint8":
		resultado = buf[0]

	case "bool":
		// Usa o bitOffset explicitamente para selecionar o bit correto
		if bitOffset >= 0 && bitOffset <= 7 {
			resultado = ((buf[0] >> uint(bitOffset)) & 0x01) == 1
		} else {
			// Caso contrário, assume primeiro bit
			resultado = (buf[0] & 0x01) == 1
		}

	case "string":
		// Verificar se o buffer tem pelo menos os 2 bytes de cabeçalho
		if len(buf) < 2 {
			return "", fmt.Errorf("buffer de string muito pequeno")
		}

		strLen := int(buf[1])
		if strLen > 254 {
			strLen = 254
		}

		// Garantir que não tentamos acessar além do tamanho do buffer
		if 2+strLen > len(buf) {
			strLen = len(buf) - 2
			if strLen < 0 {
				strLen = 0
			}
		}

		resultado = string(buf[2 : 2+strLen])
	}

	return resultado, nil
}

// WriteTag escreve um valor no PLC
func (c *Client) WriteTag(dbNumber int, byteOffset int, dataType string, bitOffset int, value interface{}) error {
	// Garante que a conexão está ativa antes de qualquer operação
	if err := c.ensureConnected(); err != nil {
		return fmt.Errorf("erro de conexão: %w", err)
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	// Normalizar o tipo de dados
	dataType = strings.ToLower(strings.TrimSpace(dataType))

	var buf []byte

	switch dataType {
	case "real":
		buf = make([]byte, 4)
		var val float32

		switch v := value.(type) {
		case float32:
			val = v
		case float64:
			val = float32(v)
		case int:
			val = float32(v)
		case int64:
			val = float32(v)
		default:
			return fmt.Errorf("%w: esperado float32, recebido %T", ErrValueConversion, value)
		}

		binary.BigEndian.PutUint32(buf, math.Float32bits(val))

	case "dint", "int32":
		buf = make([]byte, 4)
		var val int32

		switch v := value.(type) {
		case int32:
			val = v
		case int:
			val = int32(v)
		case int64:
			val = int32(v)
		case float32:
			val = int32(v)
		case float64:
			val = int32(v)
		default:
			return fmt.Errorf("%w: esperado int32, recebido %T", ErrValueConversion, value)
		}

		binary.BigEndian.PutUint32(buf, uint32(val))

	case "dword", "uint32":
		buf = make([]byte, 4)
		var val uint32

		switch v := value.(type) {
		case uint32:
			val = v
		case uint:
			val = uint32(v)
		case int:
			if v < 0 {
				return fmt.Errorf("%w: valor negativo não pode ser convertido para uint32", ErrValueConversion)
			}
			val = uint32(v)
		case float64:
			if v < 0 {
				return fmt.Errorf("%w: valor negativo não pode ser convertido para uint32", ErrValueConversion)
			}
			val = uint32(v)
		default:
			return fmt.Errorf("%w: esperado uint32, recebido %T", ErrValueConversion, value)
		}

		binary.BigEndian.PutUint32(buf, val)

	case "int", "int16":
		buf = make([]byte, 2)
		var val int16

		switch v := value.(type) {
		case int16:
			val = v
		case int:
			// Verificar se está dentro dos limites de int16
			if v > 32767 || v < -32768 {
				return fmt.Errorf("%w: valor %d está fora dos limites de int16 (-32768 a 32767)", ErrValueConversion, v)
			}
			val = int16(v)
		case float32:
			if v > 32767 || v < -32768 {
				return fmt.Errorf("%w: valor %f está fora dos limites de int16", ErrValueConversion, v)
			}
			val = int16(v)
		case float64:
			if v > 32767 || v < -32768 {
				return fmt.Errorf("%w: valor %f está fora dos limites de int16", ErrValueConversion, v)
			}
			val = int16(v)
		default:
			return fmt.Errorf("%w: esperado int16, recebido %T", ErrValueConversion, value)
		}

		binary.BigEndian.PutUint16(buf, uint16(val))

	case "word", "uint16":
		buf = make([]byte, 2)
		var val uint16

		switch v := value.(type) {
		case uint16:
			val = v
		case int:
			if v < 0 || v > 65535 {
				return fmt.Errorf("%w: valor %d está fora dos limites de uint16 (0 a 65535)", ErrValueConversion, v)
			}
			val = uint16(v)
		case float64:
			if v < 0 || v > 65535 {
				return fmt.Errorf("%w: valor %f está fora dos limites de uint16", ErrValueConversion, v)
			}
			val = uint16(v)
		default:
			return fmt.Errorf("%w: esperado uint16, recebido %T", ErrValueConversion, value)
		}

		binary.BigEndian.PutUint16(buf, val)

	case "sint", "int8":
		buf = make([]byte, 1)
		var val int8

		switch v := value.(type) {
		case int8:
			val = v
		case int:
			if v > 127 || v < -128 {
				return fmt.Errorf("%w: valor %d está fora dos limites de int8 (-128 a 127)", ErrValueConversion, v)
			}
			val = int8(v)
		case float64:
			if v > 127 || v < -128 {
				return fmt.Errorf("%w: valor %f está fora dos limites de int8", ErrValueConversion, v)
			}
			val = int8(v)
		default:
			return fmt.Errorf("%w: esperado int8, recebido %T", ErrValueConversion, value)
		}

		buf[0] = byte(val)

	case "usint", "byte", "uint8":
		buf = make([]byte, 1)
		var val uint8

		switch v := value.(type) {
		case uint8:
			val = v
		case int:
			if v < 0 || v > 255 {
				return fmt.Errorf("%w: valor %d está fora dos limites de uint8 (0 a 255)", ErrValueConversion, v)
			}
			val = uint8(v)
		case float64:
			if v < 0 || v > 255 {
				return fmt.Errorf("%w: valor %f está fora dos limites de uint8", ErrValueConversion, v)
			}
			val = uint8(v)
		default:
			return fmt.Errorf("%w: esperado uint8, recebido %T", ErrValueConversion, value)
		}

		buf[0] = val

	case "bool":
		buf = make([]byte, 1)

		// Primeiro ler o byte atual para preservar os outros bits
		err := c.client.AGReadDB(dbNumber, byteOffset, 1, buf)
		if err != nil {
			return fmt.Errorf("erro ao ler byte atual para escrita de bit: %w", err)
		}

		var val bool

		switch v := value.(type) {
		case bool:
			val = v
		case int:
			val = v != 0
		case float64:
			val = v != 0
		case string:
			val = v == "true" || v == "1" || v == "yes" || v == "sim"
		default:
			return fmt.Errorf("%w: esperado valor convertível para bool, recebido %T", ErrValueConversion, value)
		}

		// Se temos uma posição de bit específica
		if bitOffset >= 0 && bitOffset <= 7 {
			if val {
				buf[0] |= (1 << uint(bitOffset)) // set bit
			} else {
				buf[0] &= ^(1 << uint(bitOffset)) // clear bit
			}
		} else {
			// Caso contrário, assume o primeiro bit
			if val {
				buf[0] |= 0x01 // set bit 0
			} else {
				buf[0] &= 0xFE // clear bit 0
			}
		}

	case "string":
		var str string

		switch v := value.(type) {
		case string:
			str = v
		default:
			// Se não for string, converte para string
			str = fmt.Sprint(value)
		}

		if len(str) > 254 {
			str = str[:254]
		}

		buf = make([]byte, len(str)+2)
		buf[0] = 254 // max length
		buf[1] = byte(len(str))
		copy(buf[2:], str)

	default:
		return fmt.Errorf("%w: %s", ErrInvalidDataType, dataType)
	}

	// Escrever os bytes no PLC
	err := c.client.AGWriteDB(dbNumber, byteOffset, len(buf), buf)
	if err != nil {
		if isNetworkError(err) {
			c.isConnected = false
			return fmt.Errorf("%w: DB%d.%d: %v", ErrNetworkFailure, dbNumber, byteOffset, err)
		}
		return fmt.Errorf("erro ao escrever dados no PLC (DB%d.%d): %w", dbNumber, byteOffset, err)
	}

	return nil
}
