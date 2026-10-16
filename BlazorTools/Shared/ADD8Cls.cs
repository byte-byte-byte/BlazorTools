using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static BlazorTools.Shared.DataFormate;

namespace BlazorTools.Shared
{
    public class ADD8Cls
    {
        public static string ToADD8(string s)
        {
            byte[] buffer = StringToHexByte(s);
            byte src = 0;
            foreach (var b in buffer)
                src += b;
            return Convert.ToString(src, 16).ToUpper().PadLeft(2, '0') + " ";
        }
    }
    public class ADD16Cls
    {
        public static string ToADD16(string s)
        {
            byte[] buffer = StringToHexByte(s);
            ushort src = 0;
            foreach (var b in buffer)
                src += b;
            return Convert.ToString(src, 16).ToUpper().PadLeft(4, '0') + " ";
        }
    }
    public class XOR8Cls
    {
        public static string ToXor8(string s)
        {
            byte[] buffer = StringToHexByte(s);
            byte src = 0;
            foreach (var b in buffer)
                src ^= b;
            return Convert.ToString(src, 16).ToUpper().PadLeft(2, '0') + " ";
        }
    }
}
