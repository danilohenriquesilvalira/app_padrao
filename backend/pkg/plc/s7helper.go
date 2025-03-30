package plc

import (
	"encoding/binary"
	"math"
)

// GetFloat32At converte 4 bytes no formato S7 para float32
func GetFloat32At(bytes []byte, pos int) float32 {
	if pos+4 > len(bytes) {
		return 0
	}
	// Garantir que temos bytes suficientes
	bits := binary.BigEndian.Uint32(bytes[pos : pos+4])
	return math.Float32frombits(bits)
}

// SetFloat32At converte um float32 para 4 bytes no formato S7
func SetFloat32At(bytes []byte, pos int, value float32) {
	if pos+4 > len(bytes) {
		return
	}
	bits := math.Float32bits(value)
	binary.BigEndian.PutUint32(bytes[pos:pos+4], bits)
}

// GetInt16At converte 2 bytes no formato S7 para int16
func GetInt16At(bytes []byte, pos int) int16 {
	if pos+2 > len(bytes) {
		return 0
	}
	return int16(binary.BigEndian.Uint16(bytes[pos : pos+2]))
}

// SetInt16At converte um int16 para 2 bytes no formato S7
func SetInt16At(bytes []byte, pos int, value int16) {
	if pos+2 > len(bytes) {
		return
	}
	binary.BigEndian.PutUint16(bytes[pos:pos+2], uint16(value))
}

// GetUint16At converte 2 bytes no formato S7 para uint16
func GetUint16At(bytes []byte, pos int) uint16 {
	if pos+2 > len(bytes) {
		return 0
	}
	return binary.BigEndian.Uint16(bytes[pos : pos+2])
}

// SetUint16At converte um uint16 para 2 bytes no formato S7
func SetUint16At(bytes []byte, pos int, value uint16) {
	if pos+2 > len(bytes) {
		return
	}
	binary.BigEndian.PutUint16(bytes[pos:pos+2], value)
}

// GetBoolAt obtém o valor de um bit específico em um byte
func GetBoolAt(bytes []byte, bytePos, bitPos int) bool {
	if bytePos >= len(bytes) || bitPos < 0 || bitPos > 7 {
		return false
	}
	return (bytes[bytePos] & (1 << uint(bitPos))) != 0
}

// SetBoolAt define o valor de um bit específico em um byte
func SetBoolAt(bytes []byte, bytePos, bitPos int, value bool) {
	if bytePos >= len(bytes) || bitPos < 0 || bitPos > 7 {
		return
	}
	if value {
		bytes[bytePos] |= (1 << uint(bitPos)) // Ativar o bit
	} else {
		bytes[bytePos] &= ^(1 << uint(bitPos)) // Desativar o bit
	}
}
