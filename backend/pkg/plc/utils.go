package plc

import (
	"fmt"
	"reflect"
)

// CompareValues compara dois valores de qualquer tipo
// Retorna true se forem iguais, false caso contrário
func CompareValues(a, b interface{}) bool {
	// Se ambos são nil, são iguais
	if a == nil && b == nil {
		return true
	}

	// Se apenas um é nil, são diferentes
	if a == nil || b == nil {
		return false
	}

	// Verifica o tipo dos valores
	aType := reflect.TypeOf(a)
	bType := reflect.TypeOf(b)

	// Se os tipos são diferentes, tenta converter
	if aType != bType {
		// Conversão para tipos numéricos
		aVal, aOk := extractNumber(a)
		bVal, bOk := extractNumber(b)

		if aOk && bOk {
			// Comparação com tolerância para valores float
			diff := aVal - bVal
			if diff < 0 {
				diff = -diff
			}
			// Tolerância de 0.0001 para floats
			return diff < 0.0001
		}

		// Conversão para booleanos
		aBool, aOk := extractBool(a)
		bBool, bOk := extractBool(b)

		if aOk && bOk {
			return aBool == bBool
		}

		// Se não pudermos converter, são diferentes
		return false
	}

	// Comparação direta para tipos básicos
	switch v := a.(type) {
	case bool:
		return v == b.(bool)
	case int:
		return v == b.(int)
	case int8:
		return v == b.(int8)
	case int16:
		return v == b.(int16)
	case int32:
		return v == b.(int32)
	case int64:
		return v == b.(int64)
	case uint:
		return v == b.(uint)
	case uint8:
		return v == b.(uint8)
	case uint16:
		return v == b.(uint16)
	case uint32:
		return v == b.(uint32)
	case uint64:
		return v == b.(uint64)
	case float32:
		// Comparação com tolerância para float32
		diff := v - b.(float32)
		if diff < 0 {
			diff = -diff
		}
		return diff < 0.0001
	case float64:
		// Comparação com tolerância para float64
		diff := v - b.(float64)
		if diff < 0 {
			diff = -diff
		}
		return diff < 0.0001
	case string:
		return v == b.(string)
	default:
		// Para outros tipos, usar reflexão
		return reflect.DeepEqual(a, b)
	}
}

// extractNumber tenta extrair um valor numérico como float64
func extractNumber(v interface{}) (float64, bool) {
	switch val := v.(type) {
	case int:
		return float64(val), true
	case int8:
		return float64(val), true
	case int16:
		return float64(val), true
	case int32:
		return float64(val), true
	case int64:
		return float64(val), true
	case uint:
		return float64(val), true
	case uint8:
		return float64(val), true
	case uint16:
		return float64(val), true
	case uint32:
		return float64(val), true
	case uint64:
		return float64(val), true
	case float32:
		return float64(val), true
	case float64:
		return val, true
	case string:
		var f float64
		_, err := fmt.Sscanf(val, "%f", &f)
		return f, err == nil
	default:
		return 0, false
	}
}

// extractBool tenta extrair um valor booleano
func extractBool(v interface{}) (bool, bool) {
	switch val := v.(type) {
	case bool:
		return val, true
	case int:
		return val != 0, true
	case int8:
		return val != 0, true
	case int16:
		return val != 0, true
	case int32:
		return val != 0, true
	case int64:
		return val != 0, true
	case uint:
		return val != 0, true
	case uint8:
		return val != 0, true
	case uint16:
		return val != 0, true
	case uint32:
		return val != 0, true
	case uint64:
		return val != 0, true
	case float32:
		return val != 0, true
	case float64:
		return val != 0, true
	case string:
		return val == "true" || val == "1" || val == "yes", true
	default:
		return false, false
	}
}
