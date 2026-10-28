#include "core/code_format.hpp"
#include "convert/conversion_service.hpp"
#include "util/hex.hpp"

#include <cstdlib>
#include <cstring>
#include <exception>
#include <string>

namespace {

std::string last_error;

std::string_view text_or_empty(const char* value) {
    return value == nullptr ? std::string_view{} : std::string_view{value};
}

} // namespace

extern "C" {

const char* omni_last_error() {
    return last_error.c_str();
}

void omni_free(char* value) {
    std::free(value);
}

char* omni_convert(const char* input_text,
                   const char* input_format,
                   const char* output_format,
                   const char* game_name,
                   const char* crc_hex,
                   int continue_on_error) {
    try {
        const auto input = omni::parse_code_format(text_or_empty(input_format));
        if (!input) {
            last_error = "unknown input format: " + std::string(text_or_empty(input_format));
            return nullptr;
        }
        const auto output = omni::parse_code_format(text_or_empty(output_format));
        if (!output) {
            last_error = "unknown output format: " + std::string(text_or_empty(output_format));
            return nullptr;
        }

        omni::convert::Request request{*input, *output};
        request.continue_on_error = continue_on_error != 0;
        request.game_name = std::string(text_or_empty(game_name));

        if (!text_or_empty(crc_hex).empty()) {
            const auto crc = omni::hex::parse_u32(text_or_empty(crc_hex));
            if (!crc) {
                last_error = "invalid CRC: " + std::string(text_or_empty(crc_hex));
                return nullptr;
            }
            request.pnach_include_crc = true;
            request.pnach_crc = *crc;
        }

        const omni::convert::Result result =
            omni::convert::convert_text(text_or_empty(input_text), request);

        char* copy = static_cast<char*>(std::malloc(result.output_text.size() + 1U));
        if (copy == nullptr) {
            last_error = "out of memory";
            return nullptr;
        }
        std::memcpy(copy, result.output_text.c_str(), result.output_text.size() + 1U);
        last_error.clear();
        return copy;
    } catch (const std::exception& error) {
        last_error = error.what();
        return nullptr;
    } catch (...) {
        last_error = "unknown error";
        return nullptr;
    }
}

} // extern "C"
